/**
 * Read-only git history for signal extraction: one `git log --numstat -M` pass, skip merges and
 * mass commits, resolve renames into current paths. Never writes to the repo.
 */
import { execFileSync } from "node:child_process";
import { toPosix } from "../../posix.js";

export type GitCommitTouch = {
  sha: string;
  subject: string;
  /** Repo-relative POSIX paths after rename resolution (current names). */
  files: string[];
};

export type ParsedGitLog = {
  commits: GitCommitTouch[];
  /** How many commits were skipped as merges. */
  skippedMerges: number;
  /** How many commits were skipped as mass (> file limit). */
  skippedMass: number;
  /** Rename map old → new collected while parsing. */
  renames: Record<string, string>;
};

export type ReadGitLogOptions = {
  since: string;
  massCommitFileLimit: number;
};

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
  });
}

/** Follow rename chains to the newest name using the rename map built during the log walk. */
export function resolveRename(path: string, renames: Record<string, string>): string {
  let cur = path;
  const seen = new Set<string>();
  while (renames[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = renames[cur]!;
  }
  return cur;
}

/**
 * Parse `git log --numstat -M` output. Commit headers are marked with a record separator line
 * starting with `\x01COMMIT\x01`.
 */
export function parseNumstatLog(
  raw: string,
  massCommitFileLimit: number,
): ParsedGitLog {
  const commits: GitCommitTouch[] = [];
  let skippedMerges = 0;
  let skippedMass = 0;
  const renames: Record<string, string> = {};

  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.startsWith("\x01COMMIT\x01")) {
      i++;
      continue;
    }
    const parts = line.split("\x01");
    // "", "COMMIT", sha, subject, parents, ""
    const sha = parts[2] ?? "";
    const subject = parts[3] ?? "";
    const parents = (parts[4] ?? "").trim().split(/\s+/).filter(Boolean);
    i++;

    const filesRaw: string[] = [];
    while (i < lines.length && lines[i] && !lines[i]!.startsWith("\x01COMMIT\x01")) {
      const num = lines[i]!;
      i++;
      // numstat: additions \t deletions \t path   OR   path with => for renames
      const tab = num.split("\t");
      if (tab.length < 3) continue;
      const pathField = tab.slice(2).join("\t").trim();
      if (!pathField) continue;
      const rename = pathField.match(/^(.+?)\s+=>\s+(.+)$/);
      if (rename) {
        const from = toPosix(rename[1]!.replace(/^{/, "").replace(/}$/, "").trim());
        const to = toPosix(rename[2]!.replace(/^{/, "").replace(/}$/, "").trim());
        // Brace form: {old => new} already handled by regex on full field; also "dir/{a => b}"
        const brace = pathField.match(/^(.*)\{(.+)\s+=>\s+(.+)\}(.*)$/);
        if (brace) {
          const prefix = brace[1] ?? "";
          const suffix = brace[4] ?? "";
          const oldP = toPosix(`${prefix}${brace[2]!.trim()}${suffix}`);
          const newP = toPosix(`${prefix}${brace[3]!.trim()}${suffix}`);
          renames[oldP] = newP;
          filesRaw.push(newP);
        } else {
          renames[from] = to;
          filesRaw.push(to);
        }
      } else {
        filesRaw.push(toPosix(pathField));
      }
    }

    if (parents.length > 1) {
      skippedMerges++;
      continue;
    }
    if (filesRaw.length > massCommitFileLimit) {
      skippedMass++;
      continue;
    }
    if (!sha || filesRaw.length === 0) continue;

    const files = [...new Set(filesRaw.map((f) => resolveRename(f, renames)))].sort();
    commits.push({ sha, subject, files });
  }

  return { commits, skippedMerges, skippedMass, renames };
}

/** Run git log (read-only) and parse. Returns empty commits when not a git work tree / no history. */
export function readGitLog(repoRoot: string, opts: ReadGitLogOptions): ParsedGitLog {
  try {
    const raw = git(repoRoot, [
      "log",
      `--since=${opts.since}`,
      "-M",
      "--numstat",
      "--pretty=format:%x01COMMIT%x01%H%x01%s%x01%P%x01",
    ]);
    return parseNumstatLog(raw, opts.massCommitFileLimit);
  } catch {
    return { commits: [], skippedMerges: 0, skippedMass: 0, renames: {} };
  }
}

/** Per-file change counts and fix-like commit counts from a parsed log. */
export function summarizeTouches(log: ParsedGitLog, fixRe: RegExp): {
  changeCount: Map<string, number>;
  fixCount: Map<string, number>;
  /** Commits (by sha) that touched each file. */
  commitsByFile: Map<string, Set<string>>;
} {
  const changeCount = new Map<string, number>();
  const fixCount = new Map<string, number>();
  const commitsByFile = new Map<string, Set<string>>();

  for (const c of log.commits) {
    const isFix = fixRe.test(c.subject);
    for (const f of c.files) {
      changeCount.set(f, (changeCount.get(f) ?? 0) + 1);
      if (isFix) fixCount.set(f, (fixCount.get(f) ?? 0) + 1);
      let set = commitsByFile.get(f);
      if (!set) {
        set = new Set();
        commitsByFile.set(f, set);
      }
      set.add(c.sha);
    }
  }
  return { changeCount, fixCount, commitsByFile };
}

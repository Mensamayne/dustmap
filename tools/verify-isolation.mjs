#!/usr/bin/env node
/**
 * Isolation + license gate (DUST-12).
 * Fails when package `src` trees embed absolute paths, escape the monorepo, or
 * mention denylisted project names; production dependency licenses must be
 * MIT / ISC / Apache-2.0 / BSD* / BlueOak-1.0.0 (OSI-permissive used by minimatch).
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED_LICENSES = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
]);

/** Real path roots only — avoid matching regex word-boundaries like `\\bfix\\b`. */
const ABS_PATH_RE =
  /(?:[A-Za-z]:\\(?:[^\\\s]+\\)?|\/(?:Users|home|home2|opt|var\/lib)\/|\\\\[A-Za-z0-9_.$-]+\\[A-Za-z0-9_.$-]+)/;
const ESCAPE_IMPORT_RE =
  /from\s+["'](?:\.\.\/){3,}[^"']+["']|import\s*\(\s*["'](?:\.\.\/){3,}[^"']+["']\s*\)|require\s*\(\s*["'](?:\.\.\/){3,}[^"']+["']\s*\)/;

function loadDenylist(repoRoot) {
  const denylistPath = path.join(repoRoot, "tools", "isolation-denylist.json");
  if (!existsSync(denylistPath)) {
    throw new Error(`missing ${denylistPath}`);
  }
  const raw = JSON.parse(readFileSync(denylistPath, "utf8"));
  if (!Array.isArray(raw.names) || raw.names.length === 0) {
    throw new Error(`isolation-denylist.json must list names`);
  }
  return raw.names.map((n) => String(n));
}

function walkSrcFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkSrcFiles(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name) && !name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkSourceIsolation(repoRoot, names) {
  const errors = [];
  const pkgRoot = path.join(repoRoot, "packages");
  const pkgs = existsSync(pkgRoot)
    ? readdirSync(pkgRoot).filter((d) => {
        try {
          return statSync(path.join(pkgRoot, d)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];

  for (const pkg of pkgs) {
    const srcDir = path.join(pkgRoot, pkg, "src");
    for (const file of walkSrcFiles(srcDir)) {
      const text = readFileSync(file, "utf8");
      const rel = path.relative(repoRoot, file).replace(/\\/g, "/");

      if (ABS_PATH_RE.test(text)) {
        errors.push(`${rel}: absolute filesystem path`);
      }
      if (ESCAPE_IMPORT_RE.test(text)) {
        errors.push(`${rel}: import escapes monorepo (too many ../)`);
      }
      for (const name of names) {
        if (name.length < 3) continue;
        const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
        if (re.test(text)) {
          errors.push(`${rel}: denylisted name "${name}"`);
        }
      }
    }
  }
  return errors;
}

function normalizeLicense(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") return [raw.trim()];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) =>
      typeof x === "string" ? [x] : x && typeof x.type === "string" ? [x.type] : [],
    );
  }
  if (typeof raw === "object" && typeof raw.type === "string") return [raw.type];
  return [];
}

export function licenseAllowed(spdx) {
  const cleaned = spdx.replace(/^\(+/, "").replace(/\)+$/, "").trim();
  if (ALLOWED_LICENSES.has(cleaned)) return true;
  if (/\s+OR\s+/i.test(cleaned)) {
    return cleaned.split(/\s+OR\s+/i).some((part) => licenseAllowed(part.trim()));
  }
  if (/\s+AND\s+/i.test(cleaned)) {
    return cleaned.split(/\s+AND\s+/i).every((part) => licenseAllowed(part.trim()));
  }
  if (/^BSD(-\d-Clause)?$/i.test(cleaned)) return true;
  return false;
}

function readPkgJson(dir) {
  const p = path.join(dir, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function resolveProdDeps(repoRoot, pkgDir, depName) {
  const candidates = [
    path.join(pkgDir, "node_modules", ...depName.split("/")),
    path.join(repoRoot, "node_modules", ...depName.split("/")),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "package.json"))) return c;
  }
  return null;
}

export function checkLicenses(repoRoot) {
  const errors = [];
  const pkgRoot = path.join(repoRoot, "packages");
  const pkgs = existsSync(pkgRoot)
    ? readdirSync(pkgRoot).filter((d) => {
        try {
          return statSync(path.join(pkgRoot, d)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];

  const seen = new Set();
  for (const pkg of pkgs) {
    const pkgDir = path.join(pkgRoot, pkg);
    const manifest = readPkgJson(pkgDir);
    if (!manifest?.dependencies) continue;
    for (const dep of Object.keys(manifest.dependencies)) {
      if (dep.startsWith("@dustmap/")) continue;
      if (seen.has(dep)) continue;
      seen.add(dep);
      const depDir = resolveProdDeps(repoRoot, pkgDir, dep);
      if (!depDir) {
        errors.push(`missing production dependency on disk: ${dep}`);
        continue;
      }
      const depManifest = readPkgJson(depDir);
      const licenses = normalizeLicense(depManifest?.license ?? depManifest?.licenses);
      if (licenses.length === 0) {
        errors.push(`${dep}: missing license field`);
        continue;
      }
      for (const lic of licenses) {
        if (!licenseAllowed(lic)) {
          errors.push(`${dep}: disallowed license "${lic}"`);
        }
      }
    }
  }
  return errors;
}

function findActionlint(repoRoot) {
  const name = process.platform === "win32" ? "actionlint.exe" : "actionlint";
  const cached = path.join(repoRoot, ".tmp", "actionlint", name);
  return existsSync(cached) ? cached : null;
}

function ensureActionlint(repoRoot) {
  const existing = findActionlint(repoRoot);
  if (existing) return existing;

  const version = "1.7.7";
  const platform =
    process.platform === "win32"
      ? "windows_amd64"
      : process.platform === "darwin"
        ? process.arch === "arm64"
          ? "darwin_arm64"
          : "darwin_amd64"
        : process.arch === "arm64"
          ? "linux_arm64"
          : "linux_amd64";
  const ext = process.platform === "win32" ? "zip" : "tar.gz";
  const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/actionlint_${version}_${platform}.${ext}`;
  const destDir = path.join(repoRoot, ".tmp", "actionlint");
  mkdirSync(destDir, { recursive: true });
  const archive = path.join(destDir, `actionlint.${ext}`);

  try {
    execSync(`curl -fsSL -o "${archive}" "${url}"`, { cwd: repoRoot, stdio: "pipe" });
  } catch {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${archive}'"`,
        { cwd: repoRoot, stdio: "pipe" },
      );
    } else {
      throw new Error(`Failed to download actionlint from ${url}`);
    }
  }

  if (ext === "zip") {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${archive}' -DestinationPath '${destDir}' -Force"`,
      { stdio: "pipe" },
    );
  } else {
    execSync(`tar -xzf "${archive}" -C "${destDir}"`, { stdio: "pipe" });
  }

  const bin = findActionlint(repoRoot);
  if (!bin) throw new Error("actionlint binary missing after download");
  return bin;
}

export function checkActionlint(repoRoot) {
  const actionYml = path.join(repoRoot, "packages", "cli", "action", "action.yml");
  const example = path.join(repoRoot, "packages", "cli", "action", "example-workflow.yml");
  if (!existsSync(actionYml)) {
    return [`missing ${path.relative(repoRoot, actionYml)}`];
  }
  if (!existsSync(example)) {
    return [`missing ${path.relative(repoRoot, example)}`];
  }

  let bin;
  try {
    bin = ensureActionlint(repoRoot);
  } catch (err) {
    return [`actionlint download failed: ${err instanceof Error ? err.message : String(err)}`];
  }

  try {
    execSync(`"${bin}" -ignore "SC[0-9]+" "${example}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return [];
  } catch (err) {
    const out = err && typeof err === "object" && "stdout" in err ? String(err.stdout) : "";
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr) : "";
    return [`actionlint failed:\n${out}${stderr}`.trim()];
  }
}

export function runIsolationChecks(repoRoot = REPO_ROOT, opts = { actionlint: true }) {
  const names = loadDenylist(repoRoot);
  const errors = [...checkSourceIsolation(repoRoot, names), ...checkLicenses(repoRoot)];
  if (opts.actionlint !== false) {
    errors.push(...checkActionlint(repoRoot));
  }
  return errors;
}

/**
 * Negative self-test: planted denylist name and GPL dependency must turn checks red.
 */
export function runIsolationSelftest() {
  const names = loadDenylist(REPO_ROOT);
  const probe = names[0] ?? "monorepo-a";
  const tmp = mkdtempSync(path.join(tmpdir(), "dustmap-isolation-"));

  try {
    mkdirSync(path.join(tmp, "tools"), { recursive: true });
    writeFileSync(
      path.join(tmp, "tools", "isolation-denylist.json"),
      JSON.stringify({ names }, null, 2),
    );

    // --- denylist plant ---
    const leakDir = path.join(tmp, "packages", "evil", "src");
    mkdirSync(leakDir, { recursive: true });
    writeFileSync(
      path.join(leakDir, "leak.ts"),
      `/** intentional leak of ${probe} for isolation selftest */\nexport const x = 1;\n`,
    );
    const denylistErrors = checkSourceIsolation(tmp, names);
    if (!denylistErrors.some((e) => e.includes("denylisted"))) {
      throw new Error(
        `expected denylist failure for "${probe}", got: ${JSON.stringify(denylistErrors)}`,
      );
    }
    console.log("PASS: planted denylist name turns isolation red");

    // --- GPL plant ---
    const gplPkg = path.join(tmp, "packages", "gpl-host");
    const gplDep = path.join(tmp, "node_modules", "evil-gpl");
    mkdirSync(path.join(gplPkg), { recursive: true });
    mkdirSync(gplDep, { recursive: true });
    writeFileSync(
      path.join(gplPkg, "package.json"),
      JSON.stringify({ name: "@dustmap/gpl-host", dependencies: { "evil-gpl": "1.0.0" } }),
    );
    writeFileSync(
      path.join(gplDep, "package.json"),
      JSON.stringify({ name: "evil-gpl", version: "1.0.0", license: "GPL-3.0-only" }),
    );
    // Remove the denylist plant so only licenses are checked.
    rmSync(path.join(tmp, "packages", "evil"), { recursive: true, force: true });
    const licenseErrors = checkLicenses(tmp);
    if (!licenseErrors.some((e) => /GPL/i.test(e))) {
      throw new Error(`expected GPL license failure, got: ${JSON.stringify(licenseErrors)}`);
    }
    console.log("PASS: GPL dependency turns license gate red");

    if (licenseAllowed("GPL-3.0-only")) {
      throw new Error("GPL-3.0-only must not be allowed");
    }
    if (!licenseAllowed("MIT")) {
      throw new Error("MIT must be allowed");
    }
    console.log("PASS: license allowlist rejects GPL, accepts MIT");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const isDirect =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  const mode = process.argv[2];
  if (mode === "--selftest") {
    runIsolationSelftest();
    console.log("isolation.selftest: OK");
    process.exit(0);
  }

  const errors = runIsolationChecks(REPO_ROOT);
  if (errors.length) {
    console.error("isolation: FAIL");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("isolation: OK");
}

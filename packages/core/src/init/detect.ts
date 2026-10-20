/**
 * Framework / entry-point detection for `dustmap init`. Generic signals only (Next, Vite, bin,
 * scripts, tests), applied to the root package and to every workspace package with its path prefix.
 * Entry points that point into build output (e.g. `bin: dist/cli.js`) are mapped back to their
 * source via the package's tsconfig (outDir → rootDir) or the dist|build|out → src convention;
 * anything that cannot be mapped is reported in `unresolvedEntryPoints`, never silently dropped.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
import ts from "typescript";
import { toPosix } from "../posix.js";

export type UnresolvedEntryPoint = { path: string; reason: string };

export type DetectedProject = {
  frameworks: string[];
  entryPoints: string[];
  workspaces: boolean;
  testRunners: string[];
  unresolvedEntryPoints: UnresolvedEntryPoint[];
};

type Pkg = {
  name?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

/** Conventional build output directories when a package has no tsconfig outDir. */
const BUILD_DIRS = ["dist", "build", "out"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const SOURCE_EXT: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".js", ".jsx"],
  ".mjs": [".mts", ".mjs", ".ts"],
  ".cjs": [".cts", ".cjs", ".ts"],
  "": [".ts", ".tsx", ".mts", ".js", ".mjs"],
};

function readPkg(absDir: string): Pkg | null {
  const p = path.join(absDir, "package.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Pkg;
}

function hasDep(pkg: Pkg, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

function isDir(abs: string): boolean {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function isFile(abs: string): boolean {
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

function prefixed(dirRel: string, rel: string): string {
  return toPosix(dirRel ? path.posix.join(dirRel, rel) : rel);
}

function stripDotSlash(p: string): string {
  return toPosix(p).replace(/^\.\//, "");
}

function binEntries(pkg: Pkg): string[] {
  if (!pkg.bin) return [];
  if (typeof pkg.bin === "string") return [stripDotSlash(pkg.bin)];
  return Object.values(pkg.bin).map(stripDotSlash);
}

/** File arguments of `node|tsx|ts-node [flags] <file>` in package scripts. */
function scriptFileHints(pkg: Pkg): string[] {
  const out: string[] = [];
  for (const cmd of Object.values(pkg.scripts ?? {})) {
    for (const m of cmd.matchAll(/(?:^|[\s;&|])(?:node|tsx|ts-node)((?:\s+-\S+)*)\s+([^\s-][^\s]*)/g)) {
      const file = m[2];
      if (file && /\.[cm]?[jt]sx?$/.test(file)) out.push(stripDotSlash(file));
    }
  }
  return out;
}

/** Parse host that never enumerates files: we only need compiler options (incl. `extends`). */
const OPTIONS_ONLY_HOST: ts.ParseConfigHost = {
  useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: () => [],
};

const tsconfigCache = new Map<string, { outDir?: string; rootDir?: string }>();

/** outDir/rootDir of the package tsconfig (absolute), when present. */
function tsconfigDirs(pkgAbs: string): { outDir?: string; rootDir?: string } {
  const cached = tsconfigCache.get(pkgAbs);
  if (cached) return cached;
  let dirs: { outDir?: string; rootDir?: string } = {};
  const configPath = path.join(pkgAbs, "tsconfig.json");
  if (existsSync(configPath)) {
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!read.error) {
      const { options } = ts.parseJsonConfigFileContent(read.config, OPTIONS_ONLY_HOST, pkgAbs);
      dirs = {
        ...(options.outDir ? { outDir: path.resolve(options.outDir) } : {}),
        ...(options.rootDir ? { rootDir: path.resolve(options.rootDir) } : {}),
      };
    }
  }
  tsconfigCache.set(pkgAbs, dirs);
  return dirs;
}

function withSourceExtensions(baseAbs: string): string[] {
  const ext = path.extname(baseAbs);
  const known = SOURCE_EXT[ext];
  if (!known) return [baseAbs];
  const stem = ext ? baseAbs.slice(0, -ext.length) : baseAbs;
  return known.map((e) => stem + e);
}

type Resolution = { entry: string } | { unresolved: UnresolvedEntryPoint };

/**
 * Map one entry path (relative to its package) to a scannable source path relative to repoRoot.
 */
function resolveEntry(repoRoot: string, dirRel: string, relInPkg: string): Resolution {
  const pkgAbs = path.join(repoRoot, dirRel);
  const abs = path.resolve(pkgAbs, relInPkg);
  const display = prefixed(dirRel, relInPkg);
  const { outDir, rootDir } = tsconfigDirs(pkgAbs);

  const candidates: string[] = [];
  let inBuildOutput = false;
  if (outDir && (abs === outDir || abs.startsWith(outDir + path.sep))) {
    inBuildOutput = true;
    const rest = path.relative(outDir, abs);
    candidates.push(path.join(rootDir ?? path.join(pkgAbs, "src"), rest));
    if (!rootDir) candidates.push(path.join(pkgAbs, rest));
  } else {
    const [first, ...restParts] = toPosix(relInPkg).split("/");
    if (first && BUILD_DIRS.includes(first) && restParts.length) {
      inBuildOutput = true;
      const rest = restParts.join("/");
      candidates.push(path.join(pkgAbs, "src", rest), path.join(pkgAbs, rest));
    }
  }

  if (!inBuildOutput) {
    if (isFile(abs)) return { entry: toPosix(path.relative(repoRoot, abs)) };
    return { unresolved: { path: display, reason: "file does not exist" } };
  }

  for (const base of candidates) {
    for (const cand of withSourceExtensions(base)) {
      if (isFile(cand)) return { entry: toPosix(path.relative(repoRoot, cand)) };
    }
  }
  return { unresolved: { path: display, reason: "points into build output and no matching source file was found" } };
}

/** Package directories (relative, POSIX) matched by the root workspace globs. */
function workspaceDirs(repoRoot: string, globs: readonly string[]): string[] {
  if (!globs.length) return [];
  const patterns = globs.map((g) => stripDotSlash(g).replace(/\/$/, ""));
  const maxDepth = Math.max(...patterns.map((p) => (p.includes("**") ? 6 : p.split("/").length)));
  const found: string[] = [];
  function walk(relDir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(path.join(repoRoot, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || SKIP_DIRS.has(ent.name) || ent.name.startsWith(".")) continue;
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (patterns.some((p) => minimatch(rel, p)) && existsSync(path.join(repoRoot, rel, "package.json"))) {
        found.push(rel);
      }
      walk(rel, depth + 1);
    }
  }
  walk("", 1);
  return [...new Set(found)].sort();
}

/** Deepest package directory ("" = root) that contains repoRel. */
function ownerPackage(packageDirs: readonly string[], repoRel: string): string {
  let best = "";
  for (const dir of packageDirs) {
    if (dir && repoRel.startsWith(`${dir}/`) && dir.length > best.length) best = dir;
  }
  return best;
}

type Acc = {
  packageDirs: string[];
  frameworks: Set<string>;
  entryPoints: Set<string>;
  testRunners: Set<string>;
  unresolved: Map<string, UnresolvedEntryPoint>;
};

function detectPackage(repoRoot: string, dirRel: string, pkg: Pkg, acc: Acc): void {
  const pkgAbs = path.join(repoRoot, dirRel);

  if (hasDep(pkg, "next")) {
    acc.frameworks.add("next");
    if (isDir(path.join(pkgAbs, "app"))) {
      const conventions = ["page", "layout", "loading", "error", "not-found", "template", "default"];
      for (const name of conventions) {
        for (const ext of ["tsx", "ts", "jsx", "js"]) acc.entryPoints.add(prefixed(dirRel, `app/**/${name}.${ext}`));
      }
      for (const ext of ["ts", "js"]) acc.entryPoints.add(prefixed(dirRel, `app/**/route.${ext}`));
    }
    if (isDir(path.join(pkgAbs, "pages"))) acc.entryPoints.add(prefixed(dirRel, "pages/**/*.{ts,tsx,js,jsx}"));
    for (const f of ["middleware.ts", "middleware.js", "instrumentation.ts", "next.config.mjs", "next.config.js", "next.config.ts"]) {
      if (isFile(path.join(pkgAbs, f))) acc.entryPoints.add(prefixed(dirRel, f));
    }
  }

  const viteConfig = ["vite.config.ts", "vite.config.js", "vite.config.mjs"].find((f) => isFile(path.join(pkgAbs, f)));
  if (hasDep(pkg, "vite") || viteConfig) {
    acc.frameworks.add("vite");
    for (const f of ["index.html", "src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js"]) {
      if (isFile(path.join(pkgAbs, f))) acc.entryPoints.add(prefixed(dirRel, f));
    }
    if (viteConfig) acc.entryPoints.add(prefixed(dirRel, viteConfig));
  }

  const bins = binEntries(pkg);
  if (bins.length) acc.frameworks.add("node-cli");
  for (const rel of [...bins, ...scriptFileHints(pkg)]) {
    const repoRel = toPosix(path.relative(repoRoot, path.resolve(pkgAbs, rel)));
    // Dependencies are not this repo's code (e.g. `node node_modules/vitest/vitest.mjs`).
    if (repoRel.split("/").includes("node_modules")) continue;
    // A root script may point into another workspace package (`node field/dist/cli.js`):
    // resolve it against the package that owns the file, so its tsconfig/build dir applies.
    const owner = ownerPackage(acc.packageDirs, repoRel);
    const r = resolveEntry(repoRoot, owner, owner ? path.posix.relative(owner, repoRel) : repoRel);
    if ("entry" in r) acc.entryPoints.add(r.entry);
    else acc.unresolved.set(r.unresolved.path, r.unresolved);
  }

  if (hasDep(pkg, "vitest")) acc.testRunners.add("vitest");
  if (hasDep(pkg, "jest") || hasDep(pkg, "@jest/core")) acc.testRunners.add("jest");
}

/** `packages:` globs from pnpm-workspace.yaml (plain list form, the only one pnpm documents). */
function pnpmWorkspaceGlobs(repoRoot: string): string[] {
  let text: string;
  try {
    text = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  } catch {
    return [];
  }
  const globs: string[] = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line)) break;
    const m = inPackages ? /^\s*-\s*['"]?([^'"#\s]+)['"]?/.exec(line) : null;
    if (m?.[1] && !m[1].startsWith("!")) globs.push(m[1]);
  }
  return globs;
}

/** Workspace globs of the root package: npm / yarn `workspaces` plus pnpm-workspace.yaml. */
function workspaceGlobsOf(repoRoot: string, pkg: Pkg): string[] {
  const npm = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages ?? [];
  return [...npm, ...pnpmWorkspaceGlobs(repoRoot)];
}

/** Workspace package directories (relative, POSIX, sorted) — the packages Knip treats separately. */
export function listWorkspaceDirs(repoRoot: string): string[] {
  return workspaceDirs(repoRoot, workspaceGlobsOf(repoRoot, readPkg(repoRoot) ?? {}));
}

/**
 * Inspect a repository root and propose entry points for dustmap.config.json.
 */
export function detectProject(repoRoot: string): DetectedProject {
  const pkg = readPkg(repoRoot) ?? {};
  const workspaceGlobs = workspaceGlobsOf(repoRoot, pkg);
  const workspaces = workspaceGlobs.length > 0 || existsSync(path.join(repoRoot, "pnpm-workspace.yaml"));
  const packageDirs = workspaceDirs(repoRoot, workspaceGlobs);

  const acc: Acc = {
    packageDirs,
    frameworks: new Set(),
    entryPoints: new Set(),
    testRunners: new Set(),
    unresolved: new Map(),
  };

  detectPackage(repoRoot, "", pkg, acc);
  for (const dirRel of packageDirs) {
    const child = readPkg(path.join(repoRoot, dirRel));
    if (child) detectPackage(repoRoot, dirRel, child, acc);
  }

  const sorted = (s: Set<string>) => [...s].sort();
  return {
    frameworks: sorted(acc.frameworks),
    entryPoints: sorted(acc.entryPoints),
    workspaces,
    testRunners: sorted(acc.testRunners),
    unresolvedEntryPoints: [...acc.unresolved.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

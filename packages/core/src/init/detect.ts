/**
 * Framework / entry-point detection for `dustmap init`. Generic signals only (Next, Vite, bin, workspaces, tests).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { toPosix } from "../posix.js";

export type DetectedProject = {
  frameworks: string[];
  entryPoints: string[];
  workspaces: boolean;
  testRunners: string[];
};

type Pkg = {
  name?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
};

function readPkg(repoRoot: string): Pkg | null {
  const p = path.join(repoRoot, "package.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Pkg;
}

function hasDep(pkg: Pkg, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

function dirHas(repoRoot: string, rel: string): boolean {
  try {
    return statSync(path.join(repoRoot, rel)).isDirectory();
  } catch {
    return false;
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function binEntries(pkg: Pkg): string[] {
  if (!pkg.bin) return [];
  if (typeof pkg.bin === "string") return [toPosix(pkg.bin)];
  return Object.values(pkg.bin).map((v) => toPosix(v));
}

function scriptFileHints(pkg: Pkg): string[] {
  const out: string[] = [];
  for (const cmd of Object.values(pkg.scripts ?? {})) {
    const m = cmd.match(/(?:node|tsx|ts-node)\s+([^\s]+)/);
    if (m?.[1] && !m[1].startsWith("-")) out.push(toPosix(m[1]));
  }
  return out;
}

/**
 * Inspect a repository root and propose entry point globs / paths for dustmap.config.json.
 */
export function detectProject(repoRoot: string): DetectedProject {
  const pkg = readPkg(repoRoot) ?? {};
  const frameworks: string[] = [];
  const entryPoints: string[] = [];
  const testRunners: string[] = [];

  const workspaceGlobs =
    Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages ?? [];
  const workspaces = workspaceGlobs.length > 0 || existsSync(path.join(repoRoot, "pnpm-workspace.yaml"));

  if (hasDep(pkg, "next")) {
    frameworks.push("next");
    if (dirHas(repoRoot, "app")) {
      entryPoints.push(
        "app/**/page.tsx",
        "app/**/page.ts",
        "app/**/page.jsx",
        "app/**/page.js",
        "app/**/layout.tsx",
        "app/**/layout.ts",
        "app/**/route.ts",
        "app/**/route.js",
      );
    }
    if (dirHas(repoRoot, "pages")) {
      entryPoints.push("pages/**/*.{ts,tsx,js,jsx}");
    }
  }

  if (hasDep(pkg, "vite") || existsSync(path.join(repoRoot, "vite.config.ts")) || existsSync(path.join(repoRoot, "vite.config.js"))) {
    frameworks.push("vite");
    entryPoints.push("index.html", "src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js");
  }

  const bins = binEntries(pkg);
  if (bins.length) {
    frameworks.push("node-cli");
    entryPoints.push(...bins);
  }

  entryPoints.push(...scriptFileHints(pkg));

  if (hasDep(pkg, "vitest")) testRunners.push("vitest");
  if (hasDep(pkg, "jest") || hasDep(pkg, "@jest/core")) testRunners.push("jest");

  if (workspaces) {
    // Discover package.json files one level under common workspace roots for entry hints.
    for (const glob of workspaceGlobs) {
      const base = glob.replace(/\/\*\*?$/, "").replace(/\*$/, "");
      if (!base || base.includes("*")) continue;
      const abs = path.join(repoRoot, base);
      if (!dirHas(repoRoot, base)) continue;
      for (const name of readdirSync(abs)) {
        const childPkg = path.join(abs, name, "package.json");
        if (!existsSync(childPkg)) continue;
        const child = JSON.parse(readFileSync(childPkg, "utf8")) as Pkg;
        entryPoints.push(...binEntries(child).map((b) => toPosix(path.join(base, name, b))));
      }
    }
  }

  return {
    frameworks: unique(frameworks),
    entryPoints: unique(entryPoints),
    workspaces,
    testRunners: unique(testRunners),
  };
}

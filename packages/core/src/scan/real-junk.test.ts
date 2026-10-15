/**
 * A repo shaped like a real, messy monorepo (modelled on the maintainer's Monorepo-A tree):
 * gitignored temp dirs and Next build caches full of JS, node_modules, a Next app inside a
 * workspace package, and CLI packages whose bin points into dist/. The scan must see only
 * files git would show, and init must propose source entry points, not build output.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../config/load.js";
import { detectProject } from "../init/detect.js";
import { collectFiles } from "./collect-files.js";

function write(root: string, rel: string, text: string): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text, "utf8");
}

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function buildMessyMonorepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-junk-"));
  write(
    root,
    "package.json",
    JSON.stringify({
      name: "messy",
      private: true,
      workspaces: ["packages/*", "web"],
      scripts: {
        // Root scripts pointing into another package's build output and into a dependency.
        tool: "node packages/conv/dist/main.mjs",
        test: "node node_modules/vitest/vitest.mjs run",
      },
    }),
  );
  write(root, ".gitignore", ".tmp/\n**/.next/\n**/.next-dev/\nnode_modules/\n*.log\n**/dist/\n");

  // Real sources.
  write(root, "web/package.json", JSON.stringify({ name: "web", dependencies: { next: "16.0.0" } }));
  write(root, "web/app/page.tsx", "export default function Page() { return null; }\n");
  write(root, "web/app/api/health/route.ts", "export function GET() { return new Response('ok'); }\n");
  write(root, "web/lib/util.ts", "export const util = 1;\n");
  write(root, "web/middleware.ts", "export function middleware() {}\n");

  write(root, "packages/tool/package.json", JSON.stringify({ name: "tool", bin: { tool: "./dist/cli.js" } }));
  write(root, "packages/tool/tsconfig.json", '{\n  // comments are allowed in tsconfig\n  "compilerOptions": { "rootDir": "src", "outDir": "dist" },\n}\n');
  write(root, "packages/tool/src/cli.ts", "console.log('tool');\n");

  write(root, "packages/conv/package.json", JSON.stringify({ name: "conv", bin: "dist/main.mjs", scripts: { start: "node --env-file=.env dist/main.mjs" } }));
  write(root, "packages/conv/src/main.mts", "console.log('conv');\n");

  write(root, "packages/orphan/package.json", JSON.stringify({ name: "orphan", bin: { orphan: "dist/gone.js" } }));

  write(root, "packages/plain/package.json", JSON.stringify({ name: "plain", bin: { plain: "bin/plain.js" } }));
  write(root, "packages/plain/bin/plain.js", "#!/usr/bin/env node\n");

  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "init"]);

  // Junk that a real working tree accumulates — all gitignored.
  for (let i = 0; i < 200; i++) {
    write(root, `.tmp/forensics-${i}.mjs`, "export {};\n");
    write(root, `web/.next/server/chunk-${i}.js`, "module.exports = {};\n");
    write(root, `web/.next-dev/cache/${i}.js`, "module.exports = {};\n");
  }
  write(root, "node_modules/left-pad/index.js", "module.exports = () => {};\n");
  write(root, "packages/tool/dist/cli.js", "console.log('built');\n");
  write(root, "debug-run.log", "noise\n");

  // New, not yet committed, not ignored → must be scanned.
  write(root, "web/lib/fresh.ts", "export const fresh = 2;\n");
  return root;
}

describe("scan on a messy real-world repo", () => {
  const root = buildMessyMonorepo();

  it("scans only what git would show (tracked + new, never ignored junk)", () => {
    const files = collectFiles(root, defaultConfig());
    expect(files).toEqual([
      "packages/conv/src/main.mts",
      "packages/plain/bin/plain.js",
      "packages/tool/src/cli.ts",
      "web/app/api/health/route.ts",
      "web/app/page.tsx",
      "web/lib/fresh.ts",
      "web/lib/util.ts",
      "web/middleware.ts",
    ]);
  });

  it("falls back to walking the disk outside git, still honouring exclude", () => {
    const plain = mkdtempSync(path.join(tmpdir(), "dustmap-nogit-"));
    write(plain, "src/a.ts", "export const a = 1;\n");
    write(plain, "node_modules/x/index.js", "module.exports = 1;\n");
    expect(collectFiles(plain, defaultConfig())).toEqual(["src/a.ts"]);
  });

  it("detects Next inside a workspace package and maps build-output entries to sources", () => {
    const d = detectProject(root);
    expect(d.frameworks).toEqual(expect.arrayContaining(["next", "node-cli"]));
    expect(d.entryPoints).toEqual(
      expect.arrayContaining([
        "web/app/**/page.tsx",
        "web/app/**/route.ts",
        "web/middleware.ts",
        "packages/tool/src/cli.ts",
        "packages/conv/src/main.mts",
        "packages/plain/bin/plain.js",
      ]),
    );
    expect(d.entryPoints.some((e) => e.includes("/dist/"))).toBe(false);
    expect(d.entryPoints.some((e) => e.includes("node_modules"))).toBe(false);
    expect(d.unresolvedEntryPoints).toEqual([
      {
        path: "packages/orphan/dist/gone.js",
        reason: "points into build output and no matching source file was found",
      },
    ]);
  });
});

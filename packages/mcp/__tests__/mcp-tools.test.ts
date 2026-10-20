/**
 * In-process MCP client exercises every Dustmap tool on a fixture report.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fingerprint } from "@dustmap/contract";
import { afterEach, describe, expect, it } from "vitest";
import { applyResponseLimit, utf8Bytes } from "../src/limits.js";
import { createDustmapMcpServer } from "../src/server.js";
import { DUSTMAP_TOOL_NAMES, GUIDE_MAX_BYTES } from "../src/tools.js";

type Pair = {
  client: Client;
  close: () => Promise<void>;
};

async function connectPair(opts: {
  cwd: string;
  maxResponseBytes?: number;
}): Promise<Pair> {
  const server = createDustmapMcpServer({
    cwd: opts.cwd,
    ...(opts.maxResponseBytes !== undefined
      ? { maxResponseBytes: opts.maxResponseBytes }
      : {}),
  });
  const client = new Client({ name: "dustmap-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? "").trim();
}

function sampleFinding(
  pathRel: string,
  symbol: string,
  confidence: "low" | "medium" | "high" = "medium",
) {
  const fp = fingerprint("unused-export", [`export const ${symbol} = 1`], [symbol]);
  return {
    fingerprint: fp,
    kind: "unused-export" as const,
    category: "dead-code" as const,
    locations: [{ path: pathRel, startLine: 1, symbol }],
    evidence: [
      { label: "export", value: symbol },
      { label: "pad", value: "y".repeat(200) },
    ],
    confidence,
    suggestedAction: "decide" as const,
    verifyHint: "Delete the export and typecheck the package.",
    source: "knip",
  };
}

function writeFixtureRepo(opts: {
  reportCommit: string;
  findingCount?: number;
}): { root: string; outDir: string; fingerprints: string[] } {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-mcp-"));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "mcp-fixture", private: true, type: "module" }),
  );
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "used.ts"), "export const used = 1;\n");
  writeFileSync(path.join(root, "src", "dead.ts"), "export const dead = 2;\n");
  writeFileSync(
    path.join(root, "src", "index.ts"),
    "import { used } from './used.js';\nexport const main = () => used;\n",
  );

  git(root, ["init"]);
  git(root, ["config", "user.email", "mcp@dustmap.test"]);
  git(root, ["config", "user.name", "Dustmap MCP"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "init"]);

  const count = opts.findingCount ?? 3;
  const ladder: Array<"low" | "medium" | "high"> = ["high", "medium", "low"];
  const findings = Array.from({ length: count }, (_, i) =>
    sampleFinding(`src/file-${i}.ts`, `sym${i}`, ladder[i % ladder.length]!),
  );
  const fingerprints = findings.map((f) => f.fingerprint);
  const byCategory = { "dead-code": findings.length };
  const outDir = path.join(root, ".dustmap");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        schema: "dustmap.report/v1",
        scan: {
          mode: "full",
          commit: opts.reportCommit,
          startedAt: "2026-10-15T12:00:00.000Z",
          tools: [{ name: "knip", version: "5.0.0" }],
        },
        summary: {
          byCategory,
          topPlaces: [
            {
              path: findings[0]!.locations[0]!.path,
              score: 3,
              findingFingerprints: fingerprints.slice(0, 3),
            },
          ],
        },
        findings,
      },
      null,
      2,
    ),
  );

  return { root, outDir, fingerprints };
}

function textPayload(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const part = result.content.find((c) => c.type === "text");
  if (!part || part.text === undefined) {
    throw new Error("Expected text content from tool");
  }
  return part.text;
}

describe("Dustmap MCP tools (in-process client)", () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (closers.length) {
      const c = closers.pop();
      if (c) await c();
    }
  });

  it("lists all registered tools including dustmap_guide", async () => {
    const { root } = writeFixtureRepo({ reportCommit: "deadbeefdeadbeef" });
    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const listed = await pair.client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...DUSTMAP_TOOL_NAMES].sort());
    expect(names).toContain("dustmap_guide");
  });

  it("dustmap_guide + next fields walk the full agent loop on a fixture", async () => {
    const staged = writeFixtureRepo({
      reportCommit: "0000000000000000000000000000000000000000",
    });
    const head = git(staged.root, ["rev-parse", "HEAD"]);
    const reportPath = path.join(staged.outDir, "report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      scan: { commit: string };
    };
    report.scan.commit = head;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const { root, outDir, fingerprints } = staged;
    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const seen = new Set<string>();
    const guideRaw = await pair.client.callTool({ name: "dustmap_guide", arguments: {} });
    expect(guideRaw.isError).toBeFalsy();
    const guide = JSON.parse(textPayload(guideRaw));
    expect(utf8Bytes(guide.guide)).toBeLessThanOrEqual(GUIDE_MAX_BYTES);
    expect(Array.isArray(guide.next)).toBe(true);
    expect(guide.next.length).toBeGreaterThan(0);
    expect(guide.next.length).toBeLessThanOrEqual(3);
    seen.add("dustmap_guide");

    // Follow next → summary
    const summaryHint = guide.next.find(
      (n: { tool: string }) => n.tool === "dustmap_summary",
    );
    expect(summaryHint).toBeTruthy();
    const summaryRaw = await pair.client.callTool({
      name: "dustmap_summary",
      arguments: { out: outDir },
    });
    const summary = JSON.parse(textPayload(summaryRaw));
    expect(summary.next?.length).toBeGreaterThan(0);
    seen.add("dustmap_summary");

    const showHint =
      summary.next.find((n: { tool: string }) => n.tool === "dustmap_show") ??
      summary.next.find((n: { tool: string }) => n.tool === "dustmap_list");
    expect(showHint).toBeTruthy();

    let fingerprint = fingerprints[0]!;
    if (showHint.tool === "dustmap_list") {
      const listRaw = await pair.client.callTool({
        name: "dustmap_list",
        arguments: { out: outDir, ...(showHint.args ?? {}) },
      });
      const list = JSON.parse(textPayload(listRaw));
      expect(list.next?.length).toBeGreaterThan(0);
      seen.add("dustmap_list");
      fingerprint = list.items[0]?.fingerprint ?? fingerprint;
      const nextShow = list.next.find((n: { tool: string }) => n.tool === "dustmap_show");
      expect(nextShow).toBeTruthy();
    }

    const showRaw = await pair.client.callTool({
      name: "dustmap_show",
      arguments: { fingerprint, out: outDir },
    });
    const show = JSON.parse(textPayload(showRaw));
    expect(show.finding.verifyHint).toBeTruthy();
    expect(show.next.some((n: { tool: string }) => n.tool === "dustmap_decide")).toBe(true);
    seen.add("dustmap_show");

    const decideRaw = await pair.client.callTool({
      name: "dustmap_decide",
      arguments: {
        fingerprint,
        verdict: "keep",
        reason: "Intentional export kept for the guide-loop fixture.",
        out: outDir,
      },
    });
    const decide = JSON.parse(textPayload(decideRaw));
    expect(decide.recorded).toBe(true);
    expect(decide.next.some((n: { tool: string }) => n.tool === "dustmap_scan")).toBe(true);
    seen.add("dustmap_decide");

    expect(seen.has("dustmap_guide")).toBe(true);
    expect(seen.has("dustmap_summary")).toBe(true);
    expect(seen.has("dustmap_show")).toBe(true);
    expect(seen.has("dustmap_decide")).toBe(true);
  });

  it("summary / list / show / decide / scan on a fixture", async () => {
    const staged = writeFixtureRepo({
      reportCommit: "0000000000000000000000000000000000000000",
    });
    const head = git(staged.root, ["rev-parse", "HEAD"]);
    // Align report commit with this repo's HEAD so the summary is fresh.
    const reportPath = path.join(staged.outDir, "report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      scan: { commit: string };
    };
    report.scan.commit = head;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const { root, outDir, fingerprints } = staged;
    const fp = fingerprints[0]!;

    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const summaryRaw = await pair.client.callTool({
      name: "dustmap_summary",
      arguments: { out: outDir },
    });
    expect(summaryRaw.isError).toBeFalsy();
    const summary = JSON.parse(textPayload(summaryRaw));
    expect(summary.findingCount).toBeGreaterThan(0);
    expect(summary.byCategory["dead-code"]).toBeGreaterThan(0);
    expect(summary.stale).toBe(false);
    expect(summary.headAvailable).toBe(true);
    expect(summary.topPlaces.length).toBeGreaterThan(0);

    const listRaw = await pair.client.callTool({
      name: "dustmap_list",
      arguments: { out: outDir, category: "dead-code", limit: 2, offset: 0 },
    });
    expect(listRaw.isError).toBeFalsy();
    const list = JSON.parse(textPayload(listRaw));
    expect(list.items).toHaveLength(2);
    expect(list.hasMore).toBe(true);
    expect(list.total).toBe(3);

    const highOnlyRaw = await pair.client.callTool({
      name: "dustmap_list",
      arguments: {
        out: outDir,
        category: "dead-code",
        minConfidence: "high",
        limit: 20,
      },
    });
    expect(highOnlyRaw.isError).toBeFalsy();
    const highOnly = JSON.parse(textPayload(highOnlyRaw));
    expect(highOnly.total).toBe(1);
    expect(highOnly.items).toHaveLength(1);
    expect(highOnly.items.every((i: { confidence: string }) => i.confidence === "high")).toBe(
      true,
    );

    const badConf = await pair.client.callTool({
      name: "dustmap_list",
      arguments: { out: outDir, minConfidence: "extreme" },
    });
    expect(badConf.isError).toBeTruthy();

    const showRaw = await pair.client.callTool({
      name: "dustmap_show",
      arguments: { fingerprint: fp, out: outDir },
    });
    expect(showRaw.isError).toBeFalsy();
    const show = JSON.parse(textPayload(showRaw));
    expect(show.finding.fingerprint).toBe(fp);
    expect(show.finding.verifyHint).toMatch(/typecheck/i);

    const decideRaw = await pair.client.callTool({
      name: "dustmap_decide",
      arguments: {
        fingerprint: fp,
        verdict: "keep",
        reason: "Kept on purpose for the MCP e2e mute path.",
        out: outDir,
      },
    });
    expect(decideRaw.isError).toBeFalsy();
    const decide = JSON.parse(textPayload(decideRaw));
    expect(decide.recorded).toBe(true);
    expect(decide.muted).toBe(true);
    expect(existsSync(path.join(outDir, "decisions.yml"))).toBe(true);
    expect(readFileSync(path.join(outDir, "decisions.yml"), "utf8")).toContain(fp);

    const scanRaw = await pair.client.callTool({
      name: "dustmap_scan",
      arguments: { mode: "full", out: outDir },
    });
    expect(scanRaw.isError).toBeFalsy();
    const scan = JSON.parse(textPayload(scanRaw));
    expect(typeof scan.findingCount).toBe("number");
    expect(scan.stale).toBe(false);
    expect(scan.headAvailable).toBe(true);
    expect(scan.reportCommit).toBe(head);
    expect(existsSync(path.join(outDir, "report.json"))).toBe(true);
  });

  it("diff scan covers every commit since the map and never rewrites the map (BUG-03)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-mcp-diffbase-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "mcp-diffbase", private: true, type: "module" }),
    );
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "a.ts"), "export const a = 1;\n");
    git(root, ["init"]);
    git(root, ["config", "user.email", "mcp@dustmap.test"]);
    git(root, ["config", "user.name", "Dustmap MCP"]);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "a"]);
    const mapCommit = git(root, ["rev-parse", "HEAD"]);
    const outDir = path.join(root, ".dustmap");

    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);
    const full = JSON.parse(
      textPayload(await pair.client.callTool({ name: "dustmap_scan", arguments: { mode: "full", out: outDir } })),
    );
    expect(full.report).toBe("full");
    const mapBytes = readFileSync(path.join(outDir, "report.json"), "utf8");

    // Two commits after the map: a HEAD~1 base would miss b.ts.
    writeFileSync(path.join(root, "src", "b.ts"), "export const b = 2;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "b"]);
    writeFileSync(path.join(root, "src", "c.ts"), "export const c = 3;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "c"]);

    const summary = JSON.parse(
      textPayload(await pair.client.callTool({ name: "dustmap_summary", arguments: { out: outDir } })),
    );
    expect(summary.stale).toBe(true);
    expect(summary.next[0]).toMatchObject({ tool: "dustmap_scan", args: { mode: "full" } });

    const diff = JSON.parse(
      textPayload(await pair.client.callTool({ name: "dustmap_scan", arguments: { out: outDir } })),
    );
    expect(diff.mode).toBe("diff");
    expect(diff.report).toBe("diff");
    expect(diff.baseRef).toBe(mapCommit);
    expect(diff.baseRefFrom).toBe("map-commit");
    expect(diff.filesScanned).toBe(2);
    expect(diff.next[0]).toMatchObject({ tool: "dustmap_list", args: { report: "diff" } });
    expect(readFileSync(path.join(outDir, "report.json"), "utf8")).toBe(mapBytes);
    expect(existsSync(path.join(outDir, "report.diff.json"))).toBe(true);

    const lastOnly = JSON.parse(
      textPayload(
        await pair.client.callTool({ name: "dustmap_scan", arguments: { out: outDir, baseRef: "HEAD~1" } }),
      ),
    );
    expect(lastOnly.filesScanned).toBe(1);

    const diffList = JSON.parse(
      textPayload(await pair.client.callTool({ name: "dustmap_list", arguments: { out: outDir, report: "diff" } })),
    );
    expect(diffList.report).toBe("diff");
    expect(diffList.reportCommit).toBe(git(root, ["rev-parse", "HEAD"]));
  });

  it("scan in a repo without HEAD does not claim a fresh report", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-mcp-scan-nohead-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "mcp-scan-nohead", private: true, type: "module" }),
    );
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "index.ts"), "export const answer = 42;\n");
    git(root, ["init"]);
    const outDir = path.join(root, ".dustmap");

    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const scanRaw = await pair.client.callTool({
      name: "dustmap_scan",
      arguments: { mode: "full", out: outDir },
    });
    expect(scanRaw.isError).toBeFalsy();
    const scan = JSON.parse(textPayload(scanRaw));
    expect(scan.stale).toBe("unknown");
    expect(scan.headAvailable).toBe(false);
    expect(scan.staleWarning).toMatch(/HEAD is unavailable/i);
  });

  it("stale report carries a warning on every read tool", async () => {
    const { root, outDir } = writeFixtureRepo({
      reportCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const summaryRaw = await pair.client.callTool({
      name: "dustmap_summary",
      arguments: { out: outDir },
    });
    const summary = JSON.parse(textPayload(summaryRaw));
    expect(summary.stale).toBe(true);
    expect(summary.headAvailable).toBe(true);
    expect(summary.staleWarning).toMatch(/stale/i);

    const listRaw = await pair.client.callTool({
      name: "dustmap_list",
      arguments: { out: outDir },
    });
    const list = JSON.parse(textPayload(listRaw));
    expect(list.stale).toBe(true);
    expect(list.staleWarning).toMatch(/dustmap_scan/);
  });

  it("repo without HEAD reports stale unknown, never fresh", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-mcp-nohead-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "mcp-nohead", private: true, type: "module" }),
    );
    git(root, ["init"]);
    const outDir = path.join(root, ".dustmap");
    mkdirSync(outDir, { recursive: true });
    const finding = sampleFinding("src/dead.ts", "orphan");
    writeFileSync(
      path.join(outDir, "report.json"),
      JSON.stringify({
        schema: "dustmap.report/v1",
        scan: {
          mode: "full",
          commit: "cccccccccccccccccccccccccccccccccccccccc",
          startedAt: "2026-10-15T12:00:00.000Z",
          tools: [{ name: "knip", version: "5.0.0" }],
        },
        summary: {
          byCategory: { "dead-code": 1 },
          topPlaces: [
            {
              path: "src/dead.ts",
              score: 1,
              findingFingerprints: [finding.fingerprint],
            },
          ],
        },
        findings: [finding],
      }),
    );

    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const summaryRaw = await pair.client.callTool({
      name: "dustmap_summary",
      arguments: { out: outDir },
    });
    expect(summaryRaw.isError).toBeFalsy();
    const summary = JSON.parse(textPayload(summaryRaw));
    expect(summary.stale).toBe("unknown");
    expect(summary.headAvailable).toBe(false);
    expect(summary.staleWarning).toMatch(/HEAD is unavailable/i);
    expect(summary.next[0]?.tool).toBe("dustmap_scan");
  });

  it("oversized tool reply stays under the configured byte cap", async () => {
    const { root, outDir } = writeFixtureRepo({
      reportCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      findingCount: 40,
    });
    const maxBytes = 800;
    const pair = await connectPair({ cwd: root, maxResponseBytes: maxBytes });
    closers.push(pair.close);

    const listRaw = await pair.client.callTool({
      name: "dustmap_list",
      arguments: { out: outDir, limit: 50 },
    });
    const text = textPayload(listRaw);
    expect(utf8Bytes(text)).toBeLessThanOrEqual(maxBytes);
    expect(text).toMatch(/truncated/i);

    // Direct limit helper still matches the same cap contract.
    const direct = applyResponseLimit({ findings: "z".repeat(10_000) }, maxBytes);
    expect(direct.bytes).toBeLessThanOrEqual(maxBytes);
    expect(direct.truncated).toBe(true);
  });
});

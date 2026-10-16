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
import { DUSTMAP_TOOL_NAMES } from "../src/tools.js";

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

function sampleFinding(pathRel: string, symbol: string) {
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
    confidence: "medium" as const,
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
  const findings = Array.from({ length: count }, (_, i) =>
    sampleFinding(`src/file-${i}.ts`, `sym${i}`),
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

  it("lists all five tools", async () => {
    const { root } = writeFixtureRepo({ reportCommit: "deadbeefdeadbeef" });
    const pair = await connectPair({ cwd: root });
    closers.push(pair.close);

    const listed = await pair.client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...DUSTMAP_TOOL_NAMES].sort());
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
    expect(existsSync(path.join(outDir, "report.json"))).toBe(true);
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
    expect(summary.staleWarning).toMatch(/stale/i);

    const listRaw = await pair.client.callTool({
      name: "dustmap_list",
      arguments: { out: outDir },
    });
    const list = JSON.parse(textPayload(listRaw));
    expect(list.stale).toBe(true);
    expect(list.staleWarning).toMatch(/dustmap_scan/);
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

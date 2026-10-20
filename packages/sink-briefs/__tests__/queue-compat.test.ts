/**
 * Generated queue row passes this repo's JSON Schema and tools/queue/validate.mjs
 * when applied on a copy of the Dustmap briefs tree.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { fingerprint } from "@dustmap/contract";
import { DustmapConfig } from "@dustmap/core";
import { enqueueFingerprints } from "../src/enqueue.js";

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("queue compatibility", () => {
  it("generated task validates against queue.schema.json and validate.mjs on a repo copy", () => {
    const stage = mkdtempSync(path.join(tmpdir(), "dustmap-qcompat-"));
    const fp = fingerprint("unused-file", ["// dead file"], ["src/orphan.ts"]);

    // Minimal consumer with sinks.briefs + report.
    writeFileSync(
      path.join(stage, "dustmap.config.json"),
      JSON.stringify(
        {
          sinks: {
            briefs: {
              queuePath: "docs/briefs/queue.json",
              briefsDir: "docs/briefs",
              idPrefix: "DUST",
              defaults: {
                segment: "core",
                kind: "feature",
                layer: 200,
                epic: "DUST",
              },
            },
          },
        },
        null,
        2,
      ),
    );
    mkdirSync(path.join(stage, ".dustmap"), { recursive: true });
    mkdirSync(path.join(stage, "docs", "briefs"), { recursive: true });

    // Seed queue as a copy of this repo's queue so validate.mjs sees real siblings.
    cpSync(
      path.join(monorepoRoot, "docs", "briefs"),
      path.join(stage, "docs", "briefs"),
      { recursive: true },
    );
    cpSync(path.join(monorepoRoot, "tools", "queue"), path.join(stage, "tools", "queue"), {
      recursive: true,
    });

    writeFileSync(
      path.join(stage, ".dustmap", "report.json"),
      JSON.stringify(
        {
          schema: "dustmap.report/v1",
          scan: {
            mode: "full",
            commit: "abc1234",
            startedAt: "2026-10-15T12:00:00.000Z",
            tools: [{ name: "knip", version: "5.0.0" }],
          },
          summary: {
            byCategory: { "dead-code": 1 },
            topPlaces: [
              { path: "src/orphan.ts", score: 1, findingFingerprints: [fp] },
            ],
          },
          findings: [
            {
              fingerprint: fp,
              kind: "unused-file",
              category: "dead-code",
              locations: [{ path: "src/orphan.ts" }],
              evidence: [{ label: "file", value: "src/orphan.ts" }],
              confidence: "high",
              suggestedAction: "verify",
              verifyHint: "Remove the file and run the package test suite.",
              source: "knip",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = enqueueFingerprints({ cwd: stage, fingerprints: [fp] });
    expect(result.exitCode, result.stderr || result.stdout).toBe(0);
    expect(result.items[0]?.status).toBe("created");

    const queue = JSON.parse(
      readFileSync(path.join(stage, "docs", "briefs", "queue.json"), "utf8"),
    );
    const created = queue.tasks.find((t: { source?: string }) => t.source === `dustmap:${fp}`);
    expect(created).toBeTruthy();
    expect(created.gates).toEqual([]);

    const schema = JSON.parse(
      readFileSync(path.join(monorepoRoot, "docs", "briefs", "queue.schema.json"), "utf8"),
    );
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    expect(validate(queue), JSON.stringify(validate.errors)).toBe(true);

    execFileSync(process.execPath, [path.join(stage, "tools", "queue", "validate.mjs")], {
      cwd: stage,
      encoding: "utf8",
      stdio: "pipe",
    });
  });

  it("INTEGRATION-QUEUE.md example config parses with DustmapConfig (DUST-02 Zod)", () => {
    const md = readFileSync(path.join(monorepoRoot, "docs", "INTEGRATION-QUEUE.md"), "utf8");
    const match = md.match(/```json\s*\n([\s\S]*?)\n```/);
    expect(match, "expected a json fence in INTEGRATION-QUEUE.md").toBeTruthy();
    const example = JSON.parse(match![1]!);
    const parsed = DustmapConfig.safeParse(example);
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
    expect(parsed.success && parsed.data.sinks.briefs?.idPrefix).toBeTruthy();
  });
});

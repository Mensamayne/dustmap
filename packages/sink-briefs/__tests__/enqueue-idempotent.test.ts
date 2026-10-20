/**
 * Same fingerprint twice → one brief and one queue row.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint } from "@dustmap/contract";
import { enqueueFingerprints } from "../src/enqueue.js";
import { loadQueueFile, sourceKey } from "../src/queue-io.js";

function writeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-briefs-"));
  const fp = fingerprint("unused-export", ["export const dead = 1"], ["dead"]);
  mkdirSync(path.join(root, ".dustmap"), { recursive: true });
  mkdirSync(path.join(root, "docs", "briefs"), { recursive: true });

  writeFileSync(
    path.join(root, "dustmap.config.json"),
    JSON.stringify(
      {
        sinks: {
          briefs: {
            queuePath: "docs/briefs/queue.json",
            briefsDir: "docs/briefs",
            idPrefix: "HYG",
            defaults: { segment: "hygiene", kind: "feature", layer: 100, epic: "HYG" },
          },
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    path.join(root, ".dustmap", "report.json"),
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
            {
              path: "src/dead.ts",
              score: 1,
              findingFingerprints: [fp],
            },
          ],
        },
        findings: [
          {
            fingerprint: fp,
            kind: "unused-export",
            category: "dead-code",
            locations: [{ path: "src/dead.ts", startLine: 1, symbol: "dead" }],
            evidence: [{ label: "export", value: "dead" }],
            confidence: "medium",
            suggestedAction: "decide",
            verifyHint: "Delete the export and typecheck the package.",
            source: "knip",
          },
        ],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    path.join(root, "docs", "briefs", "queue.json"),
    JSON.stringify({ version: 1, tasks: [] }, null, 2),
  );

  return { root, fp };
}

describe("dustmap-briefs enqueue idempotency", () => {
  it("two calls with the same fingerprint create one brief and one queue row", () => {
    const { root, fp } = writeFixture();

    const first = enqueueFingerprints({ cwd: root, fingerprints: [fp] });
    expect(first.exitCode).toBe(0);
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.status).toBe("created");

    const second = enqueueFingerprints({ cwd: root, fingerprints: [fp] });
    expect(second.exitCode).toBe(0);
    expect(second.items[0]?.status).toBe("exists");

    const queue = loadQueueFile(path.join(root, "docs", "briefs", "queue.json"));
    expect(queue.tasks).toHaveLength(1);
    expect(queue.tasks[0]?.source).toBe(sourceKey(fp));
    expect(queue.tasks[0]?.gates).toEqual([]);

    const briefs = readdirSync(path.join(root, "docs", "briefs")).filter((f) =>
      f.endsWith(".md"),
    );
    expect(briefs).toHaveLength(1);
    const body = readFileSync(path.join(root, "docs", "briefs", briefs[0]!), "utf8");
    expect(body).toContain("Delete the export and typecheck");
    expect(body).toContain("src/dead.ts");
    expect(existsSync(path.join(root, "docs", "briefs", briefs[0]!))).toBe(true);
  });
});

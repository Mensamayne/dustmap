import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv-draft-04";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { Finding } from "./finding.js";
import { fingerprint } from "./fingerprint.js";
import { Report } from "./report.js";
import { toSarif } from "./sarif.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "../test/fixtures/sarif-schema-2.1.0.json");

describe("toSarif", () => {
  it("emits SARIF 2.1.0 that validates against the OASIS schema", () => {
    const fp = fingerprint("cycle", ["import { a } from './b'", "import { b } from './a'"], [
      "a",
      "b",
    ]);
    const finding = Finding.parse({
      fingerprint: fp,
      kind: "cycle",
      category: "structure",
      locations: [
        { path: "src/a.ts", startLine: 1 },
        { path: "src/b.ts", startLine: 1 },
      ],
      evidence: [{ label: "cycle", value: "a.ts → b.ts → a.ts" }],
      confidence: "high",
      suggestedAction: "review",
      verifyHint: "Break the cycle with a shared types module, then re-scan.",
      source: "dependency-cruiser",
    });

    const report = Report.parse({
      schema: "dustmap.report/v1",
      scan: {
        mode: "full",
        commit: "deadbeef",
        startedAt: "2026-10-15T12:00:00.000Z",
        tools: [{ name: "dependency-cruiser", version: "16.0.0" }],
      },
      summary: {
        byCategory: { structure: 1 },
        topPlaces: [
          {
            path: "src/a.ts",
            score: 2,
            findingFingerprints: [finding.fingerprint],
          },
        ],
      },
      findings: [finding],
    });

    const log = toSarif(report);
    expect(log.version).toBe("2.1.0");
    expect(log.runs[0]?.results[0]?.ruleId).toBe("cycle");
    expect(log.runs[0]?.results[0]?.level).toBe("error");
    expect(log.runs[0]?.tool.driver.rules[0]?.id).toBe("cycle");

    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
    const ajv = new Ajv({
      strict: false,
      allErrors: true,
      validateFormats: true,
    });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const ok = validate(log);
    if (!ok) {
      throw new Error(`SARIF schema errors: ${ajv.errorsText(validate.errors)}`);
    }
  });
});

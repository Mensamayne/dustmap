import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./load.js";

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-cfg-"));
    const { config, configPath } = loadConfig(root);
    expect(configPath).toBeNull();
    expect(config.outputDir).toBe(".dustmap");
    expect(config.include.length).toBeGreaterThan(0);
  });

  it("names the bad field on invalid keys", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-cfg-"));
    writeFileSync(
      path.join(root, "dustmap.config.json"),
      JSON.stringify({ outputDir: 123, notARealKey: true }),
      "utf8",
    );
    expect(() => loadConfig(root)).toThrow(/notARealKey|outputDir/);
  });
});

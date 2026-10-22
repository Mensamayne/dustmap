import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Hermetic: never the developer's installed semantic models (~/.cache/dustmap/models) or GPU.
    // Scans see "model not installed" and go on without meaning-based duplicates; tests that need a
    // model pass the tiny package in packages/core/fixtures/onnx-model explicitly.
    env: { DUSTMAP_MODELS_DIR: path.join(tmpdir(), "dustmap-tests-no-models") },
    include: ["src/**/*.test.ts", "__tests__/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});

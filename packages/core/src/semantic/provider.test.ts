import { describe, expect, it, vi } from "vitest";
import {
  assertHttpProviderAllowed,
  createOpenAiCompatibleProvider,
  isLoopbackUrl,
  RemoteEmbeddingsForbiddenError,
} from "./provider.js";

describe("semantic embedding provider", () => {
  it("rejects a remote URL without allowRemote before any fetch", async () => {
    const fetchImpl = vi.fn();
    expect(() =>
      createOpenAiCompatibleProvider(
        {
          model: "nomic-embed-text",
          url: "https://api.openai.com/v1",
          allowRemote: false,
        },
        fetchImpl,
      ),
    ).toThrow(RemoteEmbeddingsForbiddenError);
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(() =>
      assertHttpProviderAllowed({
        provider: "http",
        model: "nomic-embed-text",
        url: "https://evil.example/v1",
        allowRemote: false,
        threshold: 0.82,
        minTokens: 50,
      }),
    ).toThrow(/allowRemote/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats localhost as loopback", () => {
    expect(isLoopbackUrl("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isLoopbackUrl("http://localhost:11434/v1")).toBe(true);
    expect(isLoopbackUrl("https://api.openai.com/v1")).toBe(false);
  });
});

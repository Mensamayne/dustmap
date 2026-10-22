/**
 * `dustmap model pull / list` against a local HTTP server serving the tiny test package
 * (packages/core/fixtures/onnx-model): a good download lands verified; a file whose bytes differ
 * from the manifest, or a private package, is refused and leaves nothing on disk.
 */
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseArgs, UsageError } from "../src/args.js";
import { runModelList, runModelPull } from "../src/model-cmd.js";

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../core/fixtures/onnx-model/dustmap-test-tiny");
const ID = "dustmap-test-tiny";

/** Serves the fixture as `/<id>/<file>`; `/bad/<id>/…` alters tokenizer.json, `/private/<id>/…` marks it private. */
let server: Server;
let base = "";
beforeAll(async () => {
  server = createServer((req, res) => {
    const [, mode, id, ...rest] = (req.url ?? "").split("/");
    const file = rest.join("/");
    if (id !== ID || !existsSync(path.join(fixture, file))) {
      res.statusCode = 404;
      res.end();
      return;
    }
    let body = readFileSync(path.join(fixture, file));
    if (mode === "bad" && file === "tokenizer.json") body = Buffer.concat([body, Buffer.from(" ")]);
    if (mode === "private" && file === "manifest.json") body = Buffer.from(body.toString("utf8").replace('"private": false', '"private": true'));
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("dustmap model pull", () => {
  it("downloads, checks every SHA-256 and installs the package; list shows it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-models-"));
    const r = await runModelPull({ command: "model-pull", id: ID, from: `${base}/ok`, modelDir: dir, json: true });
    expect(r.exitCode, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ id: ID, files: 3 });
    expect(readdirSync(path.join(dir, ID)).sort()).toEqual(["manifest.json", "model.fp16.onnx", "model.onnx", "tokenizer.json"]);
    expect(readdirSync(dir)).toEqual([ID]);
    const list = runModelList({ command: "model-list", modelDir: dir, json: true });
    expect(JSON.parse(list.stdout).models).toEqual([expect.objectContaining({ id: ID, ok: true, private: false })]);
  });

  it("refuses a file that does not match the manifest and keeps nothing", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-models-bad-"));
    const r = await runModelPull({ command: "model-pull", id: ID, from: `${base}/bad`, modelDir: dir, json: false });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/tokenizer\.json does not match its SHA-256/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("refuses a private package", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-models-priv-"));
    const r = await runModelPull({ command: "model-pull", id: ID, from: `${base}/private`, modelDir: dir, json: false });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/private model package/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("without --from says where things stand instead of guessing a server", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-models-none-"));
    const r = await runModelPull({ command: "model-pull", id: ID, modelDir: dir, json: false });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/--from <url>/);
  });

  it("parses the verbs and rejects stray flags", () => {
    expect(parseArgs(["model", "pull", ID, "--from", "http://x", "--json"])).toEqual({ command: "model-pull", id: ID, from: "http://x", json: true });
    expect(parseArgs(["model", "list"])).toEqual({ command: "model-list", json: false });
    expect(() => parseArgs(["model", "list", "--from", "http://x"])).toThrow(UsageError);
    expect(() => parseArgs(["model", "fetch", ID])).toThrow(UsageError);
  });
});

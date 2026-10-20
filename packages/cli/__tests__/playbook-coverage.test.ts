/**
 * PLAYBOOK.md must name every DUST-10 CLI verb and DUST-11/17 MCP tool.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_COMMANDS, MCP_TOOLS } from "../agent/catalog.js";

const agentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../agent");
const playbook = readFileSync(path.join(agentDir, "PLAYBOOK.md"), "utf8");

describe("agent playbook coverage", () => {
  it("mentions every CLI command from DUST-10", () => {
    for (const cmd of CLI_COMMANDS) {
      expect(playbook, `missing CLI \`${cmd}\``).toMatch(new RegExp(`\\b${cmd}\\b`));
    }
  });

  it("mentions every MCP tool from DUST-11/17", () => {
    for (const tool of MCP_TOOLS) {
      expect(playbook, `missing MCP tool ${tool}`).toContain(tool);
    }
  });
});

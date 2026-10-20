/**
 * Canonical CLI verbs (DUST-10) and MCP tools (DUST-11/17) that the playbook must name.
 * Tests compare PLAYBOOK.md against these lists.
 */

/** CLI commands shipped for operators/agents (DUST-10, `list` from DUST-22). */
export const CLI_COMMANDS = [
  "init",
  "scan",
  "summary",
  "list",
  "show",
  "decide",
  "export",
  "ratchet",
] as const;

/** MCP tool names the agent may call (DUST-11 + dustmap_guide from DUST-17). */
export const MCP_TOOLS = [
  "dustmap_summary",
  "dustmap_list",
  "dustmap_show",
  "dustmap_decide",
  "dustmap_scan",
  "dustmap_guide",
] as const;

export type CliCommand = (typeof CLI_COMMANDS)[number];
export type McpTool = (typeof MCP_TOOLS)[number];

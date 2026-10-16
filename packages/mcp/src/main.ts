/**
 * Dustmap MCP entry — stdio server for Claude Code / Cursor / any MCP client.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDustmapMcpServer, type DustmapMcpOptions } from "./server.js";

export { createDustmapMcpServer, type DustmapMcpOptions } from "./server.js";
export {
  applyResponseLimit,
  DEFAULT_MAX_RESPONSE_BYTES,
  reportStaleWarning,
  TRUNCATION_NOTE,
} from "./limits.js";
export {
  DUSTMAP_TOOL_NAMES,
  dustmapDecide,
  dustmapList,
  dustmapScan,
  dustmapShow,
  dustmapSummary,
} from "./tools.js";

export async function startStdioServer(opts: DustmapMcpOptions = {}): Promise<void> {
  const server = createDustmapMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main(): Promise<void> {
  await startStdioServer();
}

const isDirect =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("main.ts") || process.argv[1].endsWith("main.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

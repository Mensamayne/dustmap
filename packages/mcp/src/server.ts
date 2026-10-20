/**
 * Build a Dustmap MCP server with agent tools and hard response limits.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  applyResponseLimit,
  DEFAULT_MAX_RESPONSE_BYTES,
  type LimitedText,
} from "./limits.js";
import {
  dustmapDecide,
  dustmapGuide,
  dustmapList,
  dustmapScan,
  dustmapShow,
  dustmapSummary,
  type McpToolContext,
  type ToolResult,
} from "./tools.js";

export type DustmapMcpOptions = {
  /** Repo working directory. Default: process.cwd() or DUSTMAP_CWD. */
  cwd?: string;
  /** Hard response size cap in bytes. Default 32 KiB. */
  maxResponseBytes?: number;
};

function resolveCwd(opts: DustmapMcpOptions): string {
  if (opts.cwd) return opts.cwd;
  if (process.env.DUSTMAP_CWD) return process.env.DUSTMAP_CWD;
  return process.cwd();
}

function toCallResult(
  result: ToolResult,
  maxResponseBytes: number,
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  if (!result.ok) {
    const limited: LimitedText = applyResponseLimit(
      { error: result.error },
      maxResponseBytes,
    );
    return {
      content: [{ type: "text", text: limited.text }],
      isError: true,
    };
  }
  const limited = applyResponseLimit(result.data, maxResponseBytes);
  return {
    content: [{ type: "text", text: limited.text }],
  };
}

/**
 * Create a configured McpServer. Caller connects a transport (stdio or in-memory).
 */
export function createDustmapMcpServer(opts: DustmapMcpOptions = {}): McpServer {
  const cwd = resolveCwd(opts);
  const maxResponseBytes = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const ctx: McpToolContext = { cwd };

  const server = new McpServer({
    name: "dustmap",
    version: "0.0.0",
  });

  server.registerTool(
    "dustmap_guide",
    {
      description:
        "Short Dustmap agent playbook (≤ 4 KiB). Start here; follow each reply's next field.",
    },
    async () => toCallResult(dustmapGuide(ctx), maxResponseBytes),
  );

  server.registerTool(
    "dustmap_summary",
    {
      description:
        "Short Dustmap report summary: category counts, top places, and whether the report matches HEAD.",
      inputSchema: {
        out: z
          .string()
          .optional()
          .describe("outputDir with report.json (default: config or .dustmap)"),
      },
    },
    async (args) =>
      toCallResult(
        dustmapSummary(ctx, {
          ...(args.out !== undefined ? { out: args.out } : {}),
        }),
        maxResponseBytes,
      ),
  );

  server.registerTool(
    "dustmap_list",
    {
      description:
        "List findings with optional category/path/minConfidence filters and pagination (offset/limit). Results are sorted highest confidence first.",
      inputSchema: {
        out: z.string().optional().describe("outputDir with report.json"),
        category: z
          .string()
          .optional()
          .describe(
            "Finding category: dead-code | duplicate | semantic-duplicate | refactor-signal | structure",
          ),
        minConfidence: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe(
            "Minimum confidence floor (inclusive). Use high + category dead-code for safest delete candidates.",
          ),
        pathPrefix: z.string().optional().describe("Only findings under this path prefix"),
        offset: z.number().int().nonnegative().optional().describe("Pagination offset (default 0)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Page size (default 20, max 50)"),
      },
    },
    async (args) =>
      toCallResult(
        dustmapList(ctx, {
          ...(args.out !== undefined ? { out: args.out } : {}),
          ...(args.category !== undefined ? { category: args.category } : {}),
          ...(args.minConfidence !== undefined
            ? { minConfidence: args.minConfidence }
            : {}),
          ...(args.pathPrefix !== undefined ? { pathPrefix: args.pathPrefix } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
        maxResponseBytes,
      ),
  );

  server.registerTool(
    "dustmap_show",
    {
      description:
        "Full evidence for one finding by fingerprint, including verifyHint (safety check before delete).",
      inputSchema: {
        fingerprint: z
          .string()
          .regex(/^[a-f0-9]{16}$/)
          .describe("16-char hex fingerprint from summary/list"),
        out: z.string().optional().describe("outputDir with report.json"),
      },
    },
    async (args) =>
      toCallResult(
        dustmapShow(ctx, {
          fingerprint: args.fingerprint,
          ...(args.out !== undefined ? { out: args.out } : {}),
        }),
        maxResponseBytes,
      ),
  );

  server.registerTool(
    "dustmap_decide",
    {
      description:
        "Record keep|fix|wontfix for a finding. Only write: .dustmap/decisions.yml under outputDir.",
      inputSchema: {
        fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
        verdict: z.enum(["keep", "fix", "wontfix"]),
        reason: z.string().min(10).describe("Why this decision (min 10 chars)"),
        out: z.string().optional(),
        by: z.string().optional().describe("Actor label (default mcp)"),
      },
    },
    async (args) =>
      toCallResult(
        dustmapDecide(ctx, {
          fingerprint: args.fingerprint,
          verdict: args.verdict,
          reason: args.reason,
          ...(args.out !== undefined ? { out: args.out } : {}),
          ...(args.by !== undefined ? { by: args.by } : {}),
        }),
        maxResponseBytes,
      ),
  );

  server.registerTool(
    "dustmap_scan",
    {
      description:
        "Run a Dustmap scan. Default mode is diff (changed files vs baseRef). Writes only under outputDir.",
      inputSchema: {
        repoPath: z.string().optional().describe("Repo root (default: server cwd)"),
        out: z.string().optional().describe("outputDir for report.json"),
        mode: z.enum(["full", "diff"]).optional().describe("Scan mode (default diff)"),
        baseRef: z
          .string()
          .optional()
          .describe("Git base ref for diff mode (default HEAD~1)"),
        config: z.string().optional().describe("Path to dustmap.config.json"),
      },
    },
    async (args) =>
      toCallResult(
        await dustmapScan(ctx, {
          ...(args.repoPath !== undefined ? { repoPath: args.repoPath } : {}),
          ...(args.out !== undefined ? { out: args.out } : {}),
          ...(args.mode !== undefined ? { mode: args.mode } : {}),
          ...(args.baseRef !== undefined ? { baseRef: args.baseRef } : {}),
          ...(args.config !== undefined ? { config: args.config } : {}),
        }),
        maxResponseBytes,
      ),
  );

  return server;
}

# Architecture

Dustmap is a **report-only** hygiene map for TypeScript/JavaScript repos. Scanners and signals normalize into one contract; ranking and decisions write under the user's `outputDir` (default `.dustmap/`). Surfaces (CLI, MCP, SARIF, queue briefs) only read that contract.

| Doc | Owns |
|-----|------|
| [INVARIANTS.md](INVARIANTS.md) | Product laws that code must never break |
| [PACKAGE-MAP.md](PACKAGE-MAP.md) | Workspace packages, dependency direction, who owns which type |

Epic binding and pipeline sketch: [docs/briefs/DUST-00-overview.md](../briefs/DUST-00-overview.md). Vision: [docs/VISION.md](../VISION.md).

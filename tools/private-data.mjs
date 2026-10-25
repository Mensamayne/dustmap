/**
 * Where the maintainer's private research data lives (REL-03): gold references into private snapshots,
 * private test targets and their configs, the isolation denylist, the public-release alias rules. It is
 * outside git (`/private/`, or `$DUSTMAP_PRIVATE_DIR`); every tool that reads it works without it, on
 * the public part alone.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const privateDir = path.resolve(process.env.DUSTMAP_PRIVATE_DIR ?? path.join(repoRoot, "private"));
export const privatePath = (...parts) => path.join(privateDir, ...parts);
export const hasPrivate = (...parts) => existsSync(privatePath(...parts));

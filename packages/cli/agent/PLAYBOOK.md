# Dustmap agent playbook

Report-only map of dead code, duplicates, and refactor signals. Dustmap **never edits** the scanned repo’s source. It writes under `outputDir` (default `.dustmap/`). The only other intentional writes are `dustmap init` (config) and `dustmap init --agent` (marked agent instruction blocks).

Primary user: an AI agent. Humans use the same CLI.

## Surfaces

| Step | MCP tool | CLI |
|------|----------|-----|
| Onboard / refresh instructions | _(install)_ | `dustmap init` · `dustmap init --agent <claude\|cursor\|codex\|all>` |
| Scan | `dustmap_scan` (default `diff`) | `dustmap scan [path] [--diff <ref>]` |
| Short overview | `dustmap_summary` | `dustmap summary` |
| Browse findings | `dustmap_list` | _(use summary --json / show)_ |
| One finding + evidence | `dustmap_show` | `dustmap show <fingerprint>` |
| Record decision | `dustmap_decide` | `dustmap decide <fp> keep\|fix\|wontfix --reason "…"` |
| Export | _(via CLI)_ | `dustmap export --to markdown\|sarif` |
| Baseline gate | _(via CLI / Action)_ | `dustmap ratchet` |
| How to use Dustmap | `dustmap_guide` | this playbook / `init --agent` |
| Optional: queue brief | _(CLI sink)_ | `dustmap-briefs enqueue <fingerprint…>` |

Every MCP reply includes `next`: 1–3 suggested follow-up tool calls. Prefer those over inventing a parallel workflow.

## Loop (do this in order)

1. **Orient** — Call `dustmap_guide` (or read this playbook). If there is no report, or `stale: true`, run `dustmap_scan` with `mode: "diff"` (CLI: `dustmap scan --diff <base>`). Full scan only when the user asks or the repo has no useful base ref.
2. **Summary** — `dustmap_summary` / `dustmap summary`. Note category counts and **top places** (paths that hurt), not a wall of fingerprints.
3. **Pick a place** — From top places, take one path or fingerprint. Optionally `dustmap_list` with `category` / `pathPrefix` / `minConfidence` and pagination (sorted high → low confidence). For safest delete candidates: `category: "dead-code"` and `minConfidence: "high"`.
4. **Evidence** — `dustmap_show` / `dustmap show <fingerprint>`. Read `verifyHint`, locations, evidence.
5. **Safety** — Before deleting or large edits, **run the verifyHint** (typecheck / tests / the command it names). Do not skip this.
6. **Decide or queue** —
   - Intentional code → `dustmap_decide` / `dustmap decide … keep|wontfix` with a real reason (≥ 10 chars).
   - Clear fix you will do in-repo → fix after verifyHint; optional `fix` decision; re-scan.
   - Needs a tracked task in a file queue → `dustmap-briefs enqueue <fingerprint>` (only selected fingerprints, never the whole report).
7. **Tell the human** — Summarize **places and effects** (e.g. “unused export in `src/dead.ts` blocks tree-shaking”). Do **not** lead with fingerprint lists.

## Hard rules

- **Do not delete** (or gut) code without running that finding’s `verifyHint` first.
- **Do not `keep` / `wontfix` without a reason** that a human could audit.
- **Stale report** (`report commit ≠ HEAD`) → `dustmap_scan` (diff) before decide/enqueue.
- **Report-only** — never ask Dustmap to commit, format, or rewrite the user’s tree (except `init` / `init --agent` as above).
- **Enqueue** only fingerprints the user or you deliberately chose; never dump the full report into the queue.
- When unsure, show evidence (`dustmap_show`) and ask; do not invent refactors.

## Freshness

If any tool returns `stale: true` / `staleWarning`, refresh with `dustmap_scan` (`diff` by default) or `dustmap scan --diff <base>`, then resume from summary.

# Dustmap agent playbook

Report-only map of dead code, duplicates, and refactor signals. Dustmap **never edits** the scanned repo’s source; it writes under `outputDir` (default `.dustmap/`). Only other writes: `dustmap init` (config) and `dustmap init --agent` (marked agent blocks).

## Two reports

- **Map** — `report.json`, the whole repo. Only a **full** scan writes it. Every reader uses it by default.
- **Diff** — `report.diff.json`, files changed since a base ref. A diff scan writes it and never touches the map. Read it with `report: "diff"` (CLI `--report diff`).

## Surfaces

| Step | MCP tool | CLI |
|------|----------|-----|
| Onboard | _(install)_ | `dustmap init` · `dustmap init --agent <claude\|cursor\|codex\|all>` |
| Scan | `dustmap_scan` (`mode` full\|diff) | `dustmap scan [path] [--diff <ref>]` |
| Overview | `dustmap_summary` | `dustmap summary` |
| Browse | `dustmap_list` | `dustmap list [--category c] [--path p] [--min-confidence high]` |
| Evidence | `dustmap_show` | `dustmap show <fingerprint>` |
| Decision | `dustmap_decide` | `dustmap decide <fp> keep\|fix\|wontfix --reason "…"` |
| Export | _(CLI)_ | `dustmap export --to markdown\|sarif` |
| Baseline gate | _(CLI / Action)_ | `dustmap ratchet` |
| Guide | `dustmap_guide` | this playbook |
| Queue brief | _(CLI sink)_ | `dustmap-briefs enqueue <fingerprint…>` |

Every MCP reply has `next`: 1–3 follow-up calls. Prefer them over a parallel workflow.

## Loop

1. **Orient** — `dustmap_guide`. No map, or the map is `stale: true` → `dustmap_scan` with `mode: "full"`.
2. **Summary** — `dustmap_summary`. Note counts and **top places**, not fingerprint walls.
3. **Pick** — a top place, or `dustmap_list` with `category` / `pathPrefix` (CLI `--path`) / `minConfidence` (CLI `--min-confidence`), sorted high → low. Safest deletes: `category: "dead-code"`, `minConfidence: "high"`.
4. **Evidence** — `dustmap_show`: `verifyHint`, locations, evidence.
5. **Safety** — **run the verifyHint** before deleting or large edits.
6. **Decide or queue** —
   - Intentional → `dustmap_decide` `keep|wontfix` with a real reason (≥ 10 chars). Hidden from the map after the next full scan.
   - Fix in-repo → fix after verifyHint, then re-scan.
   - Tracked task → `dustmap-briefs enqueue <fingerprint>` (chosen ones only).
7. **Tell the human** — places and effects (“unused export in `src/dead.ts`”), not fingerprints.

**Review only your changes:** `dustmap_scan` with `mode: "diff"` (base defaults to the map’s commit) → `dustmap_list` with `report: "diff"`.

## Duplicates

One finding per copied concept; `dustmap_show` → `group`:
- `layer`: L1 normalized copy (certain) · L2 near copy · L3 same meaning · token copy. `foundBy`: layers agreeing.
- `judgement`: a pair judge read both sides — `real-duplicate` (high), `intentional-pattern` (same skeleton, other job — maybe a parameter, check by hand), `uncertain`. None: no judge ran; `judge` evidence says why. Models: Dustmap `docs/MODELS.md`; API keys only in env.
- `original`: oldest member (git); the rest are copies.
- `sketch`: common form with `p1…` parameters, only when safe; `sketchBlocked` says why not. Text only — write the change yourself, then re-scan.
- `parts`: smaller copies inside these places.

## Hard rules

- No delete without that finding’s `verifyHint`.
- No `keep` / `wontfix` without an auditable reason.
- Stale → re-scan (map: full; diff report: diff) before decide/enqueue.
- Report-only: never ask Dustmap to commit or rewrite the tree.
- Enqueue only deliberately chosen fingerprints, never the whole report.
- Unsure → show evidence and ask; do not invent refactors.

## Freshness

`stale: true` = report commit ≠ HEAD. `stale: "unknown"` (`headAvailable: false`) = git `HEAD` unreadable (empty repo or no checkout): tell the human, treat findings as unverified, do not decide or enqueue.

# Agent dogfood — Monorepo-A snapshot (DUST-18)

**Date:** 2026-10-20  
**Snapshot:** `monorepo-a@dbe35aa00cd6` (SHA `dbe35aa00cd63fecf779ad4d48de922de45ce0f5`)  
**Harness:** `npm run agent-eval` → `tools/agent-eval/`  
**Raw results:** `.tmp/agent-eval/results.json` (not committed)

## What we measured

1. **Scripted MCP** — in-process client replays canonical tool sequences from `tasks.json` on the snapshot report (~10k findings). Checks: response size ≤ 32 KiB, `next[]` present (1–3), stale detection, decisions only under `outputDir`, enqueue of two fingerprints into a temp file queue under `.tmp/agent-eval/`.
2. **Oversize selftest** — planted oversize payload must turn expectations red (same idea as queue validate.selftest).
3. **Live Claude Code** — `claude -p` + Dustmap MCP (`--bare --mcp-config …`) for the same prompts.

## Scripted results

| Task | Prompt (short) | Result | Calls | Notes |
|------|----------------|--------|------:|-------|
| T01-guide | How to start | pass | 1 | `dustmap_guide` ≤ 4 KiB + `next` |
| T02-freshness | Is report current? | pass | 1 | `stale` boolean + `reportCommit` |
| T03-top-place | Why is place #1 on top? | pass | 2 | summary → show top fingerprint |
| T04-safe-deletes | 3 safest deletions | pass | 1 | dead-code page; ≥1 `high` on page |
| T05-decide-keep | Mark intentional | pass | 2 | `decisions.yml` only under `out/` |
| T06-stale-warning | Detect stale report | pass | 1 | planted wrong commit vs HEAD |
| T07-paginate | Second page | pass | 1 | `offset=10`, under size cap |
| T08-enqueue-two | 2 findings → queue | pass | 2 + CLI | `dustmap-briefs enqueue` → DOG-* tasks |

**Scripted: 8/8 pass.** Oversize selftest: pass.

## Live Claude Code results

| Task | Result | Calls (approx.) | What went wrong |
|------|--------|----------------:|-----------------|
| T01–T08 | fail | 0 | `claude -p` exit 1: **Not logged in · Please run /login** |

Transcripts: `.tmp/agent-eval/live/T0*.txt` (not committed).

**Verdict:** live failure is **not a Dustmap defect** — the operator environment has no Claude Code session. Re-run after `/login`:

```bash
npx tsx tools/agent-eval/run.mjs --live
# or: npm run agent-eval:live
```

## Tool issues filed from this run

| ID | Kind | Why |
|----|------|-----|
| [BUG-02](../briefs/BUG-02-stale-false-without-head.md) | bug | Snapshot with `git init` and no HEAD made freshness look “OK” (`stale: false`) until the harness created an empty commit. Product should expose “HEAD unknown”, not pretend fresh. |
| [DUST-21](../briefs/DUST-21-list-confidence-filter.md) | feature | “Safest deletions” cannot ask `dustmap_list` for `confidence=high`; agent must scan a page. |

No other tool defects blocked the scripted loop: limits, `next`, decide isolation, and enqueue idempotency held on the large report.

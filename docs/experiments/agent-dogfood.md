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

### Próba 2026-10-20 (DUST-18)

| Task | Result | Calls (approx.) | What went wrong |
|------|--------|----------------:|-----------------|
| T01–T08 | fail | 0 | `claude -p` exit 1: **Not logged in · Please run /login** |

**Verdict (corrected 2026-10-20, BUG-05):** no live result exists yet, so DUST-18 did not prove that a real agent can use Dustmap. Two causes, both outside Dustmap's product code:

1. The harness passed `--bare`, which by definition ignores the OAuth login and accepts only `ANTHROPIC_API_KEY` — it would have failed for a logged-in maintainer too. Fixed in BUG-05: `--bare` only with an API key, `--strict-mcp-config`, `stream-json` transcripts scored per task (required tools used, call budget kept), stale task gets the stale report.
2. On this machine the standalone `claude` CLI is not logged in (`claude auth status` → `loggedIn: false`; the desktop app keeps its own session). The harness now checks this first and stops with one actionable error.

### Próba 2026-10-23 (DUST-23)

`npm run agent-eval:live` — najpierw skryptowane 8/8 OK (jak wyżej), potem żywy tor:

| | |
|--|--|
| `claude auth status` | `loggedIn: false`, `authMethod: none` |
| `ANTHROPIC_API_KEY` | unset |
| exit harness | 1 |
| komunikat | `live agent harness error: claude CLI is not logged in … Run claude auth login or set ANTHROPIC_API_KEY` |

Żadnego `claude -p` na T01–T08 nie uruchomiono (precheck). Usterki narzędzi MCP **nie** da się zgłosić z tej próby — brak sesji. Zadanie DUST-23 = **blocked** do logowania maintainera.

Po `claude auth login` (albo kluczu w env):

```bash
npm run agent-eval:live
```

Scripted runs and decisions now use a throwaway copy of the report (`.tmp/agent-eval/out`); earlier runs had written two agent-eval `keep` decisions into the pinned snapshot output, muting real findings in `verify:targets` (removed).

## Tool issues filed from this run

| ID | Kind | Why |
|----|------|-----|
| [BUG-02](../briefs/BUG-02-stale-false-without-head.md) | bug | Snapshot with `git init` and no HEAD made freshness look “OK” (`stale: false`) until the harness created an empty commit. Product should expose “HEAD unknown”, not pretend fresh. |
| [DUST-21](../briefs/DUST-21-list-confidence-filter.md) | feature | “Safest deletions” cannot ask `dustmap_list` for `confidence=high`; agent must scan a page. |

No other tool defects blocked the scripted loop: limits, `next`, decide isolation, and enqueue idempotency held on the large report.

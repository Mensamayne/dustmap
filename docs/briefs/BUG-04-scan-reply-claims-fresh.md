# BUG-04 — `dustmap_scan` zawsze odpowiada „raport aktualny”

**Queue:** `BUG-04` | **Kind:** bug | **Warstwa:** 100 | **Segment:** agent | **Severity:** low | **Epik:** BUG

**Źródło:** audyt epiku DUST 2026-10-20 (dokończenie BUG-02)

## Overview

Naprawić bug: odpowiedź `dustmap_scan` ma wpisane na sztywno `stale: false`. W repo bez commitów raport dostaje commit `uncommitted`, a skan i tak mówi, że jest aktualny — dokładnie to, co BUG-02 usunął z pozostałych narzędzi. Odpowiedź skanu ma liczyć świeżość tak samo jak `summary` / `list` / `show`.

## Read first

1. `packages/mcp/src/tools.ts` — `dustmapScan`, `withFreshness`
2. `packages/mcp/src/limits.ts` — `reportFreshness`

## Plan

### Step 1 — fix at source

- **Plik:** `packages/mcp/src/tools.ts`
- **Zmiana:** odpowiedź skanu bierze `stale`, `headAvailable`, `staleWarning` z `reportFreshness(commit raportu, HEAD skanowanego repo)`; jedno odczytanie configu zamiast dwóch
- **Done when:** brak literału `stale: false` w handlerze

### Step 2 — regression guard

- **Plik:** `packages/mcp/__tests__/mcp-tools.test.ts`
- **Zmiana:** test: `dustmap_scan` w repo bez HEAD → `stale: "unknown"`, `headAvailable: false`, ostrzeżenie; w repo z commitem → `stale: false`
- **Done when:** test zielony

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`

## Pliki (zamknięta lista)

- `packages/mcp/src/tools.ts`
- `packages/mcp/__tests__/mcp-tools.test.ts`

## Weryfikacja

```bash
npm run verify
```

## Po zakończeniu

1. Commit `Fixes BUG-04: …`
2. `node tools/queue/close.mjs --id BUG-04 --note "…"`

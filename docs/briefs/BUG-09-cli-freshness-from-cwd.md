# BUG-09 — `summary` ocenia świeżość względem repo, w którym stoisz

**Queue:** `BUG-09` | **Kind:** bug | **Warstwa:** 100 | **Segment:** agent | **Severity:** low | **Epik:** BUG

**Źródło:** lab `01-martwy-kod` 2026-10-20

## Overview

Naprawić bug: `dustmap summary --out <katalog>` porównuje commit raportu z `HEAD` katalogu bieżącego, a nie skanowanego repo. Udokumentowany przepływ `npm run dustmap -- scan ../service-b --out .tmp/targets/service-b` + `summary` (DUST-19) zawsze mówi „nieaktualny”, bo porównuje z HEAD Dustmapa. Raport zawiera tylko ścieżki względne, więc czytelnik nie wie, które repo skanowano.

## Read first

1. `packages/cli/src/summary-cmd.ts` — `gitHead(cwd)`
2. `packages/mcp/src/tools.ts` — `withFreshness(…, ctx.cwd)`

## Plan

### Step 1 — fix at source

- **Plik:** `packages/core/src/scan/**`, `packages/cli/src/summary-cmd.ts`, `packages/mcp/src/tools.ts`
- **Zmiana:** skan zapisuje w `outputDir` mały plik lokalny ze ścieżką skanowanego repo (zapis tylko pod `outputDir`; kontrakt raportu bez zmian); czytelnicy liczą świeżość względem tego repo, a gdy pliku brak — względem bieżącego katalogu jak dziś
- **Done when:** `summary` wołane z innego katalogu daje to samo co z repo

### Step 2 — regression guard

- **Plik:** `packages/cli/__tests__/**`, `packages/mcp/__tests__/**`
- **Zmiana:** skan repo A, `summary` z repo B → `stale: false`
- **Done when:** test zielony; lab `01` bez 🟡 BUG-09

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Ścieżka absolutna tylko w pliku lokalnym pod `outputDir`, nigdy w `report.json` (raport jest przenośny)

## Pliki (zamknięta lista)

- `packages/core/src/scan/**`, `packages/core/src/index.ts`
- `packages/cli/src/summary-cmd.ts`, `packages/cli/__tests__/**`
- `packages/mcp/src/tools.ts`, `packages/mcp/__tests__/**`

## Weryfikacja

```bash
npm run verify
```

## Po zakończeniu

1. Commit `Fixes BUG-09: …`
2. `node tools/queue/close.mjs --id BUG-09 --note "…"`

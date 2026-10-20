# DUST-24 — Posprzątać kurz, który Dustmap znalazł u siebie

**Queue:** `DUST-24` | **Epic:** DUST | **Segment:** core | **Layer:** 24

## Overview

Self-scan (2026-10-20, `d805998`): 228 znalezisk, top miejsca to `mcp/src/tools.ts`, `cli/src/args.ts` i rozmnożone pomocniki. Narzędzie, które pokazuje kurz innym, ma mieć czyste własne podwórko. Ten brief usuwa **sprawdzone** problemy; każde znalezisko przed zmianą przechodzi przez `dustmap show` + jego `verifyHint`, a celowe dostaje decyzję `keep` z powodem (`.dustmap/decisions.yml` jest śledzony w git).

## Read first

1. `dustmap list --category duplicate --min-confidence medium` i `dustmap list --category dead-code --min-confidence high` (po BUG-06 — bez danych testowych)

## Plan

### Step 1 — Kopie kodu

- **Plik:** `packages/core/src/adapters/jscpd/run.ts`, `packages/core/src/adapters/knip/run.ts`, `packages/core/src/semantic/jscpd-semantic.ts`, `packages/core/src/scan/git.ts`, `packages/core/src/signals/git/log.ts`, `packages/*/bin/*.mjs`
- **Zmiana:** jedno źródło dla: budowy drzewa plików do skanu (3 kopie, ~100 linii), ścieżki do binarki jscpd (2), wrappera `git` (2), startera `tsx` w binarkach (3 × ~114 linii)
- **Done when:** te klastry znikają z self-scanu; zero zmian zachowania (testy bez zmian zielone)

### Step 2 — Parser argumentów CLI

- **Plik:** `packages/cli/src/args.ts`
- **Zmiana:** `parseArgs` (250 linii, zawiłość 63) → opis flag per komenda + jedna pętla parsowania; ten sam tekst błędów
- **Done when:** sygnał `complexity` dla `parseArgs` znika; testy CLI bez zmian zielone

### Step 3 — Martwy kod

- **Plik:** `packages/core/src/scan/run-scan.ts` (`assertPathIsFile`), `packages/core/src/signals/git/diff-mode.ts` (`parseLogForTests`), `tools/tkr/lib/git-proof.mjs` (`resetGitLogCache`), `packages/cli/agent/catalog.ts` (`CliCommand`), `tools/tkr/tkr-check-ready.mjs`, `tools/tkr/tkr-stamp-closure.mjs`
- **Zmiana:** usunąć albo `keep` z powodem (np. narzędzie TKR wołane ręcznie wg `tools/tkr/README.md`)
- **Done when:** `dustmap list --category dead-code --min-confidence high` = 0 bez decyzji bez powodu

### Step 4 — `.gitignore`

- **Plik:** `.gitignore`
- **Zmiana:** `.dustmap/report.diff.json` (BUG-03) obok `report.json`
- **Done when:** skan zmian nie zostawia nieśledzonego pliku

## Constraints

- Żadnych zmian zachowania produktu — tylko struktura kodu
- `fail-on.mjs` w akcji zostaje bez zależności (świadoma kopia `resolveOutDir`) → `keep` z powodem

## Pliki (scope)

- `packages/*/src/**`, `packages/*/bin/**`, `tools/tkr/**`, `.dustmap/decisions.yml`, `.gitignore`

## Weryfikacja

```bash
npm run verify
npm run dustmap -- -- scan .
npm run dustmap -- -- summary
```

Notatka zamknięcia: liczby self-scanu przed/po (znaleziska, top 5 miejsc).

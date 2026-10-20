# BUG-03 — Skan „tylko zmian” kasuje całą mapę; odświeżenie bierze złą bazę

**Queue:** `BUG-03` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** high | **Epik:** BUG

**Źródło:** audyt epiku DUST 2026-10-20 (skan tego repo: `full` = 216 znalezisk → `scan --diff HEAD~1` w ten sam `outputDir` = 8)

## Overview

Naprawić bug: skan w trybie `diff` nadpisuje `report.json` samymi znaleziskami z dotkniętych plików. Playbook i pola `next` każą agentowi po każdej decyzji i przy nieaktualnym raporcie robić `dustmap_scan` (diff) — więc po pierwszym kroku pętli agent traci mapę całego repo, a `summary` mówi „raport aktualny”. Do tego odświeżenie domyślnie porównuje z `HEAD~1`, a nie z commitem raportu: gdy raport jest 10 commitów za `HEAD`, 9 z nich nigdy nie trafia do skanu.

## Decyzja maintainera (przed startem)

Co ma zapisać `diff`, gdy w `outputDir` jest już raport:
- **(A, rekomendacja)** scalić: znaleziska dotykające zmienionych plików (i sąsiadów z grafu) zastąpione nowymi, reszta zostaje; `scan.mode` + nowe pole o bazie odświeżenia mówią, co się stało;
- (B) osobny plik raportu diff, `report.json` zostaje pełny;
- (C) odświeżanie zawsze `full` (dziś kosztowne: cache jest na cały zbiór plików, Knip na Monorepo-A ~530 s).

## Read first

1. `packages/core/src/scan/run-scan.ts` — zapis `report.json` bez względu na tryb
2. `packages/mcp/src/tools.ts` — `dustmapScan`, domyślne `baseRef: "HEAD~1"`, `suggestNext`
3. `packages/cli/agent/PLAYBOOK.md` — pętla „decide → scan diff”

## Plan

### Step 1 — Raport po `diff` nie traci reszty repo

- **Plik:** `packages/core/src/scan/run-scan.ts`, `packages/contract/src/report.ts`
- **Zmiana:** wg decyzji A/B/C powyżej; kontrakt mówi jawnie, jaki zakres pokrywa raport
- **Done when:** test: `full` → `diff` jednego pliku → znaleziska z nietkniętych plików nadal w raporcie

### Step 2 — Odświeżenie od commitu raportu

- **Plik:** `packages/mcp/src/tools.ts`, `packages/cli/src/scan-cmd.ts`
- **Zmiana:** `dustmap_scan` bez `baseRef` przy istniejącym raporcie bierze `report.scan.commit` jako bazę (nie `HEAD~1`)
- **Done when:** test: raport 3 commity za HEAD → diff obejmuje pliki ze wszystkich 3

### Step 3 — Opis dla agenta i człowieka

- **Plik:** `packages/cli/agent/PLAYBOOK.md`, `packages/cli/src/summary-cmd.ts`
- **Zmiana:** summary mówi, czy raport jest pełny, czy częściowy; playbook opisuje odświeżanie bez utraty mapy
- **Done when:** playbook coverage test zielony

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Report-only bez zmian: zapis tylko pod `outputDir`
- GitHub Action (świeży checkout, brak poprzedniego raportu) działa jak dziś

## Pliki (zamknięta lista)

- `packages/core/src/scan/**`, `packages/core/__tests__/**`, `packages/contract/src/report.ts`
- `packages/mcp/src/tools.ts`, `packages/mcp/__tests__/**`
- `packages/cli/src/scan-cmd.ts`, `packages/cli/src/summary-cmd.ts`, `packages/cli/__tests__/**`, `packages/cli/agent/PLAYBOOK.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
npm run agent-eval
```

## Po zakończeniu

1. Commit `Fixes BUG-03: …`
2. `node tools/queue/close.mjs --id BUG-03 --note "…"` + liczby: full vs full→diff na Service-B

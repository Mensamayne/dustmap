# DUST-19 — Pierwsza komenda: `dustmap scan` + `dustmap summary`

**Queue:** `DUST-19` | **Epic:** DUST | **Segment:** cli | **Layer:** 19

## Overview

Zaraz po pierwszym wykrywaczu (martwy kod, DUST-03) człowiek i agent mogą uruchomić Dustmap z terminala na dowolnym repo i zobaczyć wynik. Bez tego do DUST-10 nie ma czego odpalić. DUST-10 dokłada potem resztę komend do tej samej paczki — nie tworzy drugiego CLI.

## Plan

### Step 1 — Paczka i dwie komendy

- **Plik:** `packages/cli/` (`bin/dustmap.mjs`, `src/`)
- **Zmiana:** `dustmap scan [ścieżka] [--diff <ref>] [--config <plik>] [--out <katalog>]` — woła rdzeń ze wszystkimi gotowymi adapterami; `dustmap summary [--out <katalog>] [--json]` — liczby per kategoria, top 10 miejsc z liczbą sygnałów, wiek raportu względem `HEAD`. Kody wyjścia: 0 OK, 2 błąd użycia/configu. Każde wyjście kończy się linią „dalej:” z następną sensowną komendą.
- **Done when:** test e2e na fixture: `scan` → `summary` pokazuje znalezisko z adaptera Knip.

### Step 2 — Uruchomienie z repo i na celach

- **Plik:** `package.json`, `tools/targets/run.mjs`
- **Zmiana:** `npm run dustmap -- …` z root tego repo; runner celów (DUST-16) woła tę komendę zamiast rdzenia bezpośrednio.
- **Done when:** `npm run dustmap -- scan ../service-b --out .tmp/targets/service-b` + `summary` działa.

## Constraints

- Żadna komenda nie zmienia skanowanego repo (poza `init`, które przyjdzie w DUST-10)
- Wyjście krótkie domyślnie; pełne dane tylko przez `--json`

## Pliki (scope)

- `packages/cli/**`, `package.json`, `package-lock.json`, `tools/targets/run.mjs`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

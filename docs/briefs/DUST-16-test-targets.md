# DUST-16 — Cele testowe: Monorepo-A, Service-B, zbiór prawdy

**Queue:** `DUST-16` | **Epic:** DUST | **Segment:** core | **Layer:** 16

## Overview

Agent piszący Dustmap jedną komendą skanuje prawdziwe repo maintainera i dostaje liczby: ile znalezisk, jak szybko, ile trafnych względem ręcznie przejrzanej próbki. Cele są tylko do odczytu, wynik ląduje w tym repo. Od tego briefu każda zmiana wyniku skanu jest mierzona na Monorepo-A, a nie tylko na małych fixtures.

## Read first

1. [docs/TEST-TARGETS.md](../TEST-TARGETS.md) — opis celów i zasady (SSOT tego briefu)

## Plan

### Step 1 — Rejestr i runner

- **Plik:** `tools/targets/targets.json`, `tools/targets/run.mjs`
- **Zmiana:** cele `monorepo-a`, `service-b`, `self` (ścieżka względna + nadpisanie env `DUSTMAP_TARGET_<NAZWA>`); `npm run target -- <cel> [--snapshot <sha>]` woła rdzeń z `outputDir: .tmp/targets/<cel>[@sha]/`. Snapshot = `git archive <sha>` z celu do `.tmp/` (żadnego zapisu w celu). Brak katalogu celu = czytelny komunikat, kod 2.
- **Done when:** test: runner na celu-atrapie nie tworzy ani jednego pliku w katalogu celu (porównanie listy plików i `git status` celu przed/po).

### Step 2 — Konfiguracja Monorepo-A

- **Plik:** `tools/targets/monorepo-a.dustmap.config.json`, `tools/targets/service-b.dustmap.config.json`
- **Zmiana:** punkty wejścia i wykluczenia z tabeli w TEST-TARGETS (trasy app router, `defineAction`, `bin`, skrypty, seedy, `monorepo-a-‹private›/`, `‹private›-java/`, generowane `‹private›/`).
- **Done when:** config przechodzi walidację Zod z DUST-02; skan `monorepo-a` nie wywraca się na Javie / Dart / JSON.

### Step 3 — Zbiór prawdy i porównanie

- **Plik:** `tools/targets/ground-truth/`, `tools/targets/compare.mjs`
- **Zmiana:** format `{ target, sha, entries: [{ fingerprint, verdict: real|false-positive|intended-pattern, why }], forbidden: [{ glob, kind, maxConfidence }] }`; `npm run target:compare -- monorepo-a` → trafność `high` na próbce, naruszenia zakazów, nowe znaleziska bez werdyktu. Start: zakaz „`**/app/**/page.tsx` i `route.ts` nie mogą być `unused-file` z `high`”.
- **Done when:** test negatywny: wstrzyknięte naruszenie zakazu → kod 1.

### Step 4 — Wpięcie w `verify`

- **Plik:** `tools/verify.mjs`, `package.json`
- **Zmiana:** `npm run verify:targets` = `target` + `compare` dla `monorepo-a` (snapshot przypięty w ground-truth) i `service-b`; **nie** w domyślnym `verify` (wymaga repo obok), opisane w AGENTS.md jako obowiązkowe przy zamknięciu briefów zmieniających wynik skanu.
- **Done when:** `verify:targets` na tym komputerze daje liczby; na komputerze bez celów mówi „cel niedostępny” i nie udaje zielonego.

## Constraints

- Zero zapisu w katalogach celów; zero zapisujących operacji git w celach; zero uruchamiania skryptów celów
- Ścieżki maintainera tylko w `tools/targets/`, nigdy w `packages/*/src`

## Pliki (scope)

- `tools/targets/**`, `tools/verify.mjs`, `package.json`, `AGENTS.md`, `docs/TEST-TARGETS.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

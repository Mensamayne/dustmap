# DUST-03 — Adapter Knip (martwy kod)

**Queue:** `DUST-03` | **Epic:** DUST | **Segment:** core | **Layer:** 3

## Overview

Raport pokazuje nieużywane pliki, eksporty i zależności z dowodem „nikt tego nie importuje” oraz podpowiedzią, jak bezpiecznie sprawdzić usunięcie. Punkty wejścia z konfiguracji DUST-02 trafiają do Knip, żeby trasy frameworka i skrypty nie wyglądały na martwe.

## Plan

### Step 1 — Uruchomienie Knip

- **Plik:** `packages/core/src/adapters/knip/run.ts`
- **Zmiana:** Knip jako zależność (nie fork); przekazanie `entryPoints` / `include` / workspaces; wyjście `--reporter json`. Wersja Knip w `scan.tools`.
- **Done when:** fixture z celowo martwym plikiem, eksportem i zależnością → wszystkie trzy wykryte.

### Step 2 — Normalizacja do kontraktu

- **Plik:** `packages/core/src/adapters/knip/normalize.ts`
- **Zmiana:** `unused-file`, `unused-export`, `unused-type`, `unused-dependency`, `unlisted-dependency` → `Finding` z fingerprintem (treść symbolu, nie wiersz), `evidence` (ile miejsc w repo wspomina nazwę jako tekst — sygnał ładowania „po nazwie”), `verifyHint` (typecheck + testy pakietu).
- **Done when:** symbol wspomniany w stringu dostaje `confidence: low`, a nie `high`.

### Step 3 — Fałszywe alarmy jako test

- **Plik:** `packages/core/__tests__/knip-false-positives.test.ts`
- **Zmiana:** fixture Next z `page.tsx`, `route.ts`, `bin` CLI, plikiem ładowanym dynamicznym `import()` → **zero** znalezisk `high` dla nich.
- **Done when:** test zielony.

## Constraints

- Pliki wejściowe z ról (DUST-20): domyślnie `filesWithRole("source")` + `test` jako punkty wejścia grafu; nigdy `generated` / `vendored` / `minified` / `oversized`
- Adapter tylko czyta wynik Knip; żadnego `knip --fix`
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/adapters/knip/**`
- `packages/core/__tests__/**`
- `packages/core/fixtures/**`
- `packages/core/package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

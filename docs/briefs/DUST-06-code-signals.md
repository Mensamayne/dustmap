# DUST-06 — Sygnały makaronu w kodzie

**Queue:** `DUST-06` | **Epic:** DUST | **Segment:** core | **Layer:** 6

## Overview

Raport wskazuje miejsca, które *wyglądają* na kandydatów do przebudowy: zawiła funkcja, ogromny plik, długa lista parametrów, flagi tak/nie przełączające zachowanie, ten sam warunek rozsiany po wielu plikach. Tylko diagnoza z dowodem — bez propozycji, jak przebudować.

## Plan

### Step 1 — Metryki funkcji i plików (AST TypeScript)

- **Plik:** `packages/core/src/signals/code/metrics.ts`
- **Zmiana:** kompilator TS (bez ESLint jako zależności rdzenia): zawiłość cyklomatyczna i kognitywna, głębokość zagnieżdżeń, długość funkcji, liczba parametrów, parametry `boolean`, rozmiar pliku. Progi w configu z rozsądnymi domyślnymi.
- **Done when:** fixture ze znanymi wartościami — metryki zgodne co do liczby.

### Step 2 — Powtórzone warunki

- **Plik:** `packages/core/src/signals/code/repeated-conditions.ts`
- **Zmiana:** znormalizowane porównania z literałem (`x.kind === 'sorbet'`, `case 'sorbet':`) zliczane po repo; ≥ N plików (config) → `refactor-signal` / `repeated-branch` z listą miejsc. To sygnał „brakuje jednego miejsca, które o tym decyduje”.
- **Done when:** fixture z warunkiem w 6 plikach → jedno znalezisko z 6 lokacjami.

### Step 3 — Kształt znaleziska

- **Plik:** `packages/core/src/signals/code/to-findings.ts`
- **Zmiana:** każdy sygnał → `Finding` (`category: refactor-signal`), `evidence` czytelne („zawiłość 34, próg 15”), `suggestedAction` tylko w formie „przejrzyj”, nigdy konkretny refaktor.
- **Done when:** test: żadne znalezisko z tej kategorii nie zawiera słów typu „extract”, „split into”.

## Constraints

- Pliki wejściowe z ról (DUST-20): domyślnie `filesWithRole("source")`; nigdy `generated` / `vendored` / `minified` / `oversized`
- Sygnały, nie recepty
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/signals/code/**`
- `packages/core/__tests__/**`, `fixtures/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

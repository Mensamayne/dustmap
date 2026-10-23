# PAIR-04 — Wpięcie głowy w skan

**Queue:** `PAIR-04` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 4

## Overview

Po kosinusie kandydatów skan odpytuje głowę: do `semantic-duplicate` wchodzą głównie pary `same`; `pattern` obniża pewność; `other` wypada spod progu raportu.

## Plan

### Step 1 — Filtrowanie par

- **Plik:** `packages/core/src/semantic/run.ts`, `pair-head.ts`, `cluster.ts`, testy
- **Zmiana:** gdy paczka ma `pairHead`, po `pairsAboveThreshold` przelicz score = P(same) (albo odfiltruj nie-same); pattern → `lowerConfidence` jak dziś sharedPattern. Bump `ADAPTER_REV`.
- **Done when:** testy jednostkowe zielone; skan z fixture z głową zachowuje się zgodnie z klasami

## Constraints

- Bez list nazw / ścieżek projektów
- Brak pairHead = zachowanie EMB-15 (tylko cosinus)

## Pliki (scope)

- `packages/core/src/semantic/**`, `packages/core/__tests__/**`

## Weryfikacja

```bash
npm run verify
```

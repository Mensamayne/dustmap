# BUG-07 — Para „po sensie”: druga strona dostaje nazwę i treść pierwszej

**Queue:** `BUG-07` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** medium | **Epik:** BUG

**Źródło:** self-scan 2026-10-20 (`mcp/src/tools.ts#runScanCommand` — takiej funkcji tam nie ma); lab `03-ten-sam-sens` (`stats/total-of.ts#totalPositive`)

## Overview

Naprawić bug: jscpd zwraca jeden `fragment` (z pierwszego pliku), a `runJscpdSemanticPairs` bierze z niego nazwę **i treść** dla obu stron pary. Skutki: (1) zła etykieta drugiego miejsca w raporcie; (2) odcisk grupy liczony z treści jednej strony — zmiana drugiej funkcji nie zmienia odcisku, więc decyzja „zostaw” jej nie wygasa.

## Read first

1. `packages/core/src/semantic/jscpd-semantic.ts` — pętla po `report.duplicates`, `guessName(fragment, …)` dla `a` i `b`
2. `packages/core/src/semantic/cluster.ts` — skąd brana jest treść do odcisku

## Plan

### Step 1 — fix at source

- **Plik:** `packages/core/src/semantic/jscpd-semantic.ts`
- **Zmiana:** treść i nazwa każdej strony z jej własnego pliku (linie `start..end` z raportu jscpd, czytane z drzewa skanu)
- **Done when:** obie strony mają własną nazwę i treść

### Step 2 — regression guard

- **Plik:** `packages/core/src/semantic/cluster.test.ts` albo `packages/core/__tests__/**`
- **Zmiana:** nagrany raport jscpd z parą `totalOf` ↔ `foldSum` → lokacje `#totalOf` i `#foldSum`; zmiana treści drugiej funkcji → nowy odcisk grupy
- **Done when:** test zielony; lab `03` bez 🟡 BUG-07

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Odciski grup „po sensie” zmienią się raz — w notatce close: decyzje i baseline dla `semantic-cluster` trzeba odświeżyć

## Pliki (zamknięta lista)

- `packages/core/src/semantic/**`
- `packages/core/__tests__/**` (tylko test tego buga)

## Weryfikacja

```bash
npm run verify
```

Plus `node run-lab.mjs 03` w `../dustmap-lab`.

## Po zakończeniu

1. Commit `Fixes BUG-07: …`
2. `node tools/queue/close.mjs --id BUG-07 --note "…"`

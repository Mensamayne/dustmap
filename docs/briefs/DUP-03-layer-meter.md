# DUP-03 — Miernik per warstwa

**Queue:** `DUP-03` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 2

## Overview

Każda warstwa ma własną liczbę: L1/L2 precyzja zgłoszeń (złoto + lab), L3 odnalezienie partnera w top-k (dziś 92% w top-20 na Monorepo-A), L4 AP i precyzja sędziego na zestawie testowym, pułapka. Koniec z jedną liczbą AP par jako miarą postępu.

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Odnalezienie partnera w top-k

- **Plik:** `tools/emb/**` (na wzór `dustmap-emb/recall_at_k.py`)
- **Zmiana:** recall@k per etykieta przez ścieżkę produktu (dostawca onnx)
- **Done when:** miernik raportuje recall@10/20/50

### Step 2 — Precyzja L1/L2 na złocie

- **Plik:** `tools/emb/**`
- **Zmiana:** pary złota, które L1/L2 zgłaszają, i ile z nich to duplikaty
- **Done when:** liczba w raporcie miernika

### Step 3 — Raport jednym poleceniem

- **Plik:** `tools/emb/eval.mts`, `package.json`
- **Zmiana:** `npm run dup:meter` wypisuje wszystkie warstwy
- **Done when:** liczby w `docs/experiments/dup-results.md`

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `tools/emb/**`
- `package.json`
- `docs/experiments/dup-results.md`
- Added during work: `packages/core/src/index.ts` (exports `extractUnits`, `openVectorCache`, `nearPairs` for the meter — the product path, not a copy of it); the meter is `tools/emb/dup-meter.mts` beside `eval.mts`, which keeps its EMB role

## Weryfikacja

```bash
npm run dup:meter
npm run verify
```

## Wyjście (acceptance)

- [ ] Miary L1–L4 i pułapka w jednym raporcie

## Po zakończeniu

1. Commit `Fixes DUP-03: …`
2. `node tools/queue/close.mjs --id DUP-03 --note "…"`

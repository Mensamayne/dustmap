# DUP-08 — Sędzia par v2: kopie z innymi nazwami jako duplikaty, szybkość na CPU

**Queue:** `DUP-08` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 3

## Overview

Sędzia par z DUP-04 (`dustmap-pair-judge-private`) dobrze odrzuca wzorce (pułapka 51/193 zamiast 187/193 u Qwena) i podnosi precyzję L2 do 0,97. Ma dwie luki, zmierzone w `docs/experiments/dup-results.md` (DUP-04):

1. **Myli kopie różniące się nazwą albo stałą z różną robotą.** Na Monorepo-A odrzucił budowniczego ścieżek wykresu ×3 (inna nazwa typu), czytnik identyfikatorów reguł ×8 (inna stała), dwa parsery JSON z CLI. Przyczyna w danych: negatywy „ta sama sygnatura”, „ta sama nazwa” uczą, że inne identyfikatory to inna robota. AP na teście 0,736 (cel DUP-04: ≥ 0,80).
2. **Na CPU 4,4 pary/s** (karta 75/s). Cel DUP-04: ≥ 50/s na CPU.

## Read first

1. `docs/experiments/dup-results.md` (DUP-03, DUP-04)
2. `../dustmap-emb/data/judge/train_cross.py`, `export_judge.py`

## Plan

### Step 1 — Pozytywy „kopia z innymi nazwami / stałymi”

- **Plik:** `../dustmap-emb/data/judge/**`
- **Zmiana:** pary z L1-kształtu i L2 (szkic bezpieczny, różnice tylko w stałych / nazwach) z korpusu jako pozytywy; bez par z kodu testu złota (bramka przecieków)
- **Done when:** AP na teście ≥ 0,80, pułapka ≤ 60/193, precyzja L1-kształt + L2 po sędzi ≥ 0,95

### Step 2 — Szybkość na CPU

- **Plik:** `../dustmap-emb/data/judge/**`
- **Zmiana:** mniejszy sędzia (destylacja do 6 warstw) albo krótsze wejście (256 tokenów); pomiar AP i par/s
- **Done when:** ≥ 50 par/s na CPU przy AP ≥ 0,78, albo udokumentowana granica

## Constraints

- GPU: ≤ 8 GB i ≤ wolne − 0,5 GB wg nvidia-smi (`common.cap_gpu`)
- Prywatny kod i model nie opuszczają komputera
- Test i pułapka nigdy w treningu

## Pliki (scope)

- `../dustmap-emb/data/judge/**`
- `packages/core/src/semantic/pair-judge.ts`
- `docs/experiments/dup-results.md`
- Added during work: `packages/core/src/semantic/cluster.ts`, `packages/core/src/semantic/run.ts`, `packages/core/src/config/schema.ts` (`semantic.judgedMinBand`, from the review through the fixed path); BUG-14 split off as its own task

## Weryfikacja

```bash
npm run dup:meter -- --no-l3 --judge-package dustmap-pair-judge-private
npm run verify
```

## Wyjście (acceptance)

- [ ] AP na teście ≥ 0,80
- [ ] ≥ 50 par/s na CPU albo udokumentowana granica

## Po zakończeniu

1. Commit `Fixes DUP-08: …`
2. `node tools/queue/close.mjs --id DUP-08 --note "…"`

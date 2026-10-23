# CON-09 — Paczka danych i pomiar bazowy

**Queue:** `CON-09` | **Epic:** CON | **Segment:** semantic | **Layer:** 5

## Overview

Zbiór treningowy v2 jest zbudowany, przypięty i opisany. Obecny model (z EMB-15) jest zmierzony na zestawie testowym v2 osobno dla każdej jednostki i etykiety. Te liczby to punkt startu dla **CON-11** (trening v2 i porównanie z EMB-15): widać, gdzie model jest dziś ślepy (np. `contains`, klasy, CSS).

## Read first

1. `docs/briefs/CON-08-gates-and-card.md`
2. `docs/experiments/emb-results.md` — wyniki EMB-15

## Plan

### Step 1 — Zbudowanie i przypięcie

- **Plik:** `../dustmap-emb/data/build_dataset.py`, `../dustmap-emb/DATA-CARD.md`
- **Zmiana:** zbiór `train` / `validation` w `E:\dustmap-emb-data\data` z manifestem: odcisk SHA-256 każdego pliku, wersje źródeł, data. Wariant tylko prywatny.
- **Done when:** manifest zapisany; ponowna budowa daje te same odciski

### Step 2 — Pomiar bazowy

- **Plik:** `tools/emb/eval.mts`, `docs/experiments/emb-results.md`
- **Zmiana:** miernik raportuje AP oraz precyzję i wykrywalność przy progu z kalibracji, osobno dla jednostek (funkcja, fragment, klasa, CSS) i etykiet pozytywnych (`same`, `contains`, `concept`). Uruchomić na modelu z EMB-15.
- **Done when:** tabela w emb-results; krótki wniosek po polsku: gdzie model jest najsłabszy

### Step 3 — Przekazanie do CON-11

- **Plik:** `docs/briefs/CON-00-overview.md`
- **Zmiana:** liczby zbioru, wynik bazowy, lista znanych słabości danych (trening i porównanie = CON-11)
- **Done when:** CON-11 może ruszyć bez pytań o dane

## Constraints

- Bez treningu w tym briefie (trening = CON-11)
- Prywatne dane zostają na tym komputerze

## Pliki (scope)

- `../dustmap-emb/data/build_dataset.py`, `../dustmap-emb/DATA-CARD.md`, `tools/emb/eval.mts`, `tools/emb/gold-data.mts`, `docs/experiments/emb-results.md`, `docs/briefs/CON-00-overview.md`

## Weryfikacja

```bash
npm run emb:eval -- --selftest
npm run verify
```

## Wyjście (acceptance)

- [ ] Zbiór przypięty manifestem, budowa powtarzalna
- [ ] Wynik bazowy per jednostka i etykieta w emb-results

## Po zakończeniu

1. Commit `Fixes CON-09: …`
2. `node tools/queue/close.mjs --id CON-09 --note "…"`

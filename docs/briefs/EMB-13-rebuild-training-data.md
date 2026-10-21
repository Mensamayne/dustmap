# EMB-13 — Dane treningowe wg definicji odpowiedzialności

**Queue:** `EMB-13` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Dane treningowe uczą modelu tej samej definicji co miernik: ta sama odpowiedzialność (w tym poprawka błędu i rozjechana kopia = duplikat). Mniej sztucznych przepisanych kopii tej samej funkcji. Bez mutantów i bez bliźniaków algorytmów z generatora. Etykiety się nie gryzą.

## Read first

1. `tools/emb/gold/README.md` — definicja „ta sama odpowiedzialność”
2. `../dustmap-emb/DATA-CARD.md` — obecne źródła i proporcje
3. `docs/experiments/emb-results.md` — EMB-12: mutanty pogorszyły AP

## Plan

### Step 1 — Usunąć sztuczne źródła

- **Plik:** `../dustmap-emb/data/positives/algorithms.mjs`, generatory mutantów, `../dustmap-emb/DATA-CARD.md`, `../dustmap-emb/data/dataset.json`
- **Zmiana:** wyciąć pary „inny algorytm” i mutanty z budowy zbioru; wagi i manifest bez tych klas
- **Done when:** przebudowany zbiór nie zawiera tych id / źródeł; karta danych to opisuje

### Step 2 — Więcej prawdziwych duplikatów, mniej rewrite

- **Plik:** `../dustmap-emb/data/history/**`, `../dustmap-emb/data/clones/**`, `../dustmap-emb/data/rewrite/**`, `../dustmap-emb/data/dataset.json`
- **Zmiana:** poprawki błędów (historia `fix`) wchodzą jako pozytywy `same` wg definicji; ograniczyć nadmiar przekształceń składni (nadpróbkowanie / limit wersji); zachować trudne negatywy EMB-05
- **Done when:** proporcje w karcie danych: rewrite nie dominuje jak dziś (~96%); są pary fix→before/after

### Step 3 — Spójność etykiet

- **Plik:** `../dustmap-emb/data/**` (skrypt kontroli), `docs/experiments/emb-results.md` albo karta danych
- **Zmiana:** automatyczna kontrola sprzeczności (ta sama para / te same teksty z różnymi etykietami; pozytyw pokrywający się z trudnym negatywem); zero sprzeczności albo jawna lista odrzuceń
- **Done when:** `check_leakage.py` + nowa kontrola etykiet zielone; wynik w karcie / emb-results

## Constraints

- Zero przecieku do złota (w tym `real-refs.jsonl` z EMB-12)
- Model publiczny: tylko dane publiczne + syntetyczne; prywatne tylko w wariancie private
- Nie trenować w tym briefie — tylko dane

## Pliki (scope)

- `../dustmap-emb/data/**`, `../dustmap-emb/DATA-CARD.md`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
python ../dustmap-emb/data/check_leakage.py
python ../dustmap-emb/data/check_leakage.py --selftest
```

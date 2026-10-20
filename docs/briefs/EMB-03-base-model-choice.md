# EMB-03 — Wybór modelu bazowego

**Queue:** `EMB-03` | **Epic:** EMB | **Segment:** semantic | **Layer:** 3

## Overview

Zanim cokolwiek douczymy: 3–4 małe, otwarte modele kodu porównane na zbiorze wzorcowym bez douczania. Wybór opiera się na liczbach (jakość, szybkość, rozmiar, licencja), a nie na reklamie.

## Read first

1. `docs/experiments/emb-results.md` — wynik bazowy (EMB-01)
2. `docs/experiments/emb-env.md` — zgody na pobranie (EMB-02)

## Plan

### Step 1 — Kandydaci

- **Plik:** `docs/experiments/emb-base-models.md`
- **Zmiana:** lista z licencją **sprawdzoną u źródła** (karta modelu, plik LICENSE), liczbą parametrów, długością kontekstu, rozmiarem. Punkt wyjścia do sprawdzenia: `jina-embeddings-v2-base-code` (obecny), `CodeRankEmbed` (domyślny w jscpd 5.4), `codet5p-110m-embedding`, `unixcoder-base`. Odpadają: > ~150 M parametrów albo licencja spoza MIT / Apache-2.0 / BSD
- **Done when:** tabela kandydatów z linkami do licencji

### Step 2 — Pomiar bez douczania

- **Plik:** `../dustmap-emb/eval_zero_shot.py` + `tools/emb/eval.mts` (wektory przez lokalny serwer HTTP albo plik wektorów)
- **Zmiana:** każdy kandydat na tym samym zbiorze i tym samym mierniku; CPU i GPU
- **Done when:** tabela w `emb-results.md`

### Step 3 — Decyzja

- **Plik:** `docs/experiments/emb-base-models.md`
- **Zmiana:** wybrany model + uzasadnienie liczbami; drugi w kolejce, gdyby trening zawiódł
- **Done when:** maintainer akceptuje wybór (zacytowane „tak”)

## Constraints

- Pobieranie wag tylko tych, na które jest zgoda w EMB-02

## Pliki (scope)

- `docs/experiments/emb-base-models.md`, `docs/experiments/emb-results.md`, `tools/emb/**`, `../dustmap-emb/**`

## Weryfikacja

```bash
npm run emb:eval -- --provider http --url http://127.0.0.1:<port>/v1
```

# Dane treningowe modelu „ta sama odpowiedzialność” (EMB-04…05, EMB-13)

**Stan:** przebudowane 21.10.2026 (EMB-13). Pełny opis: [`dustmap-emb/DATA-CARD.md`](../../../dustmap-emb/DATA-CARD.md). Kod: `dustmap-emb/data/`. Dane (nie w gicie): `E:\dustmap-emb-data\data`. Definicja etykiet: `tools/emb/gold/README.md`.

## W skrócie

- **Pozytywy** — przekształcenia składni (limit 2 wersje / funkcja, waga 0,25), historia git (edited / moved / **fix** jako same), kopie z klastrów Dustmapa. Poprawka błędu przed/po = duplikat odpowiedzialności, nie negatyw.
- **Trudne negatywy** — wzorce (prefix / factory / signature), ta sama nazwa, mapowania odwrotne. **Bez** bliźniaków algorytmów i **bez** mutantów (usunięte: pogarszały miernik).
- **Zbiór** `public` / `private`, trening / walidacja; przy składaniu wycinane funkcje ze złota (w tym `real-refs.jsonl`). Bramki: `check_leakage.py`, `check_labels.py`.
- Exact counts: `E:\dustmap-emb-data\data\dataset\*\manifest.json`.

## Decyzje EMB-13

- Fix commits → pozytywy (`kind: fix`), nie `neg-fix`.
- Rewrite capped (`rewriteMaxPerAnchor: 2`) + niska waga, żeby nie zalać prawdziwych par.
- Sprzeczna etykieta 0 i 1 na tej samej parze → negatyw wypada przy składaniu.

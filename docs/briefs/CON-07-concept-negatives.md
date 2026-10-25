# CON-07 — Trudne negatywy dla koncepcji

**Queue:** `CON-07` | **Epic:** CON | **Segment:** semantic | **Layer:** 3

## Overview

Model łapiący szerzej łatwo zacznie łączyć wszystko, co wygląda podobnie: każde repozytorium, każdy handler, każdy przycisk. Trudne negatywy uczą go granicy:
- ten sam szkielet, inne zadanie;
- to samo działanie na innej encji;
- wywołujący i wywoływany;
- adapter testowy i prawdziwy;
- siostrzane metody liczące inne wielkości z tych samych danych.

To samo dla klas i CSS.

## Read first

1. `../dustmap-emb/data/negatives/**` — negatywy z EMB-05/13
2. `docs/briefs/CON-00-overview.md` § Definicja (granice)
3. `tools/emb/gold/README.md` § Siostry w jednym pliku — potok harvest → seed → merge → `real-refs`
4. `tools/emb/gold/same-file-siblings-candidates.jsonl` — **202** `needs-label` (reszta już w złocie: nested + seed)
5. `docs/experiments/design-note-filter-vs-con-negatives.md` — warstwa B

## Plan

### Step 0 — Domknąć siostry z EMB-10 (wejście gotowe)

- **Plik:** `tools/emb/gold/same-file-siblings-candidates.jsonl` → po etykiecie `merge-same-file-siblings.mts --apply`
- **Zmiana:** ręcznie ocenić 202 `needs-label` (`pattern` / rzadko `same` / `different`); nie wlewać hurtowo propozycji `pattern`
- **Już zrobione poza tym briefem:** 114 par w `real-refs` (seed + nested → `different` / `pattern`), produkt pomija zagnieżdżenia
- **Done when:** zero `needs-label` albo świadoma kolejka odłożona; `npm run emb:gold` zielone

### Step 1 — Negatywy funkcji i fragmentów

- **Plik:** `../dustmap-emb/data/negatives/**`
- **Zmiana:** dołożyć brakujące rodzaje: wywołujący ↔ wywoływany (z grafu wywołań), adapter testowy ↔ prawdziwy (ten sam interfejs), siostrzane metody tej samej klasy na innym polu, fragment ↔ inny fragment tej samej funkcji; wciągnąć ocenione siostry z Step 0 do negatywów treningowych wg karty danych
- **Done when:** każdy rodzaj policzony w karcie danych

### Step 2 — Negatywy klas

- **Plik:** `../dustmap-emb/data/negatives/classes.mjs` (nowy)
- **Zmiana:** klasy o tym samym kształcie dla innych encji (repozytoria, serwisy) → `pattern`; klasy ze wspólnym rodzicem albo interfejsem, ale innym zachowaniem → `pattern` / `different`
- **Done when:** ręczny przegląd 30 par ≥ 90%

### Step 3 — Negatywy CSS

- **Plik:** `../dustmap-emb/data/negatives/css.mjs` (nowy)
- **Zmiana:** reguły z tymi samymi właściwościami i innymi wartościami, które realnie zmieniają wygląd → `pattern`; reguły-narzędzia (reset, utility) zestawione z regułami komponentów → `different`
- **Done when:** ręczny przegląd 30 par ≥ 90%

### Step 4 — Proporcje

- **Plik:** `../dustmap-emb/data/dataset.json`
- **Zmiana:** na każdy pozytyw danej jednostki co najmniej jeden trudny negatyw tej samej jednostki
- **Done when:** bilans w karcie danych

## Constraints

- Negatyw nie może kolidować z pozytywem (sprawdza CON-08)
- Bez list wyjątków per projekt

## Pliki (scope)

- `../dustmap-emb/data/negatives/**`, `../dustmap-emb/data/dataset.json`, `../dustmap-emb/DATA-CARD.md`

## Weryfikacja

```bash
python ../dustmap-emb/data/check_labels.py
```

## Wyjście (acceptance)

- [ ] Negatywy dla funkcji, fragmentów, klas i CSS
- [ ] Przeglądy ręczne zapisane, proporcje spełnione

## Po zakończeniu

1. Commit `Fixes CON-07: …`
2. `node tools/queue/close.mjs --id CON-07 --note "…"`

# CON-08 — Bramki: spójność etykiet, przeciek, bilans, karta danych

**Queue:** `CON-08` | **Epic:** CON | **Segment:** semantic | **Layer:** 4

## Overview

Zanim zbiór pójdzie do treningu, automat potwierdza cztery rzeczy:
- żadna para nie przeczy innej;
- nic z zestawu testowego nie przeciekło, także jako fragment większej jednostki;
- proporcje źródeł, jednostek i etykiet są takie, jak zapisano;
- karta danych opisuje wszystko liczbami.

Każda bramka ma selftest z podłożonym błędem, który musi wywołać czerwony wynik.

## Read first

1. `../dustmap-emb/data/check_leakage.py`, `../dustmap-emb/data/check_labels.py`
2. `../dustmap-emb/DATA-CARD.md`

## Plan

### Step 1 — Spójność etykiet

- **Plik:** `../dustmap-emb/data/check_labels.py`
- **Zmiana:** sprzeczność = ta sama para (po odciskach) z różnymi etykietami; pozytyw i negatyw na tych samych tekstach; `contains` z odwrotnym `larger` w dwóch źródłach; przechodniość (A same B, B same C, A different C) zgłoszona do przeglądu
- **Done when:** zero sprzeczności albo jawna lista odrzuceń; selftest łapie każdy rodzaj

### Step 2 — Przeciek

- **Plik:** `../dustmap-emb/data/check_leakage.py`
- **Zmiana:** zestaw testowy v2 (wszystkie jednostki). Przeciek = jednostka treningowa równa jednostce testowej, zawierająca ją (fragment testowy wewnątrz funkcji treningowej) albo z tego samego pliku co para testowa z części `test`.
- **Done when:** zero przecieków; selftest łapie przeciek przez zawieranie

### Step 3 — Bilans

- **Plik:** `../dustmap-emb/data/build_dataset.py`, `../dustmap-emb/data/dataset.json`
- **Zmiana:** raport: pary per jednostka × etykieta × źródło. Bramka pilnuje progów z CON-06 (generowane ≤ 40% pozytywów) i CON-07 (≥ 1 trudny negatyw na pozytyw w jednostce). Żadne pojedyncze źródło nie ma > 50% pozytywów.
- **Done when:** bramka zielona; raport w karcie danych

### Step 4 — Karta danych

- **Plik:** `../dustmap-emb/DATA-CARD.md`
- **Zmiana:** definicja, źródła z licencjami, operacje, progi, przeglądy ręczne z wynikami, bilans, znane słabości
- **Done when:** karta odpowiada na pytanie „skąd jest każda para” bez czytania kodu

## Constraints

- Bramek nie wolno osłabiać, żeby przeszły; naprawia się dane

## Pliki (scope)

- `../dustmap-emb/data/check_labels.py`, `../dustmap-emb/data/check_leakage.py`, `../dustmap-emb/data/build_dataset.py`, `../dustmap-emb/data/dataset.json`, `../dustmap-emb/DATA-CARD.md`

## Weryfikacja

```bash
python ../dustmap-emb/data/check_labels.py --selftest
python ../dustmap-emb/data/check_leakage.py --selftest
python ../dustmap-emb/data/check_labels.py
python ../dustmap-emb/data/check_leakage.py
```

## Wyjście (acceptance)

- [ ] Cztery bramki zielone, selftesty czerwone na podłożonych błędach
- [ ] Karta danych kompletna

## Po zakończeniu

1. Commit `Fixes CON-08: …`
2. `node tools/queue/close.mjs --id CON-08 --note "…"`

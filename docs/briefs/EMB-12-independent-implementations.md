# EMB-12 — Domknięcie zestawu testowego (prawdziwy kod)

**Queue:** `EMB-12` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Zestaw wzorcowy ma wystarczająco dużo ręcznie ocenionych par z prawdziwego kodu (Monorepo-A, Service-B), żeby mierzyć model poza ręcznie pisanymi przykładami. Trening nigdy nie widzi tych funkcji. Miernik raportuje wynik na prawdziwym kodzie osobno od całości.

## Read first

1. `tools/emb/gold/README.md` — definicja „ta sama odpowiedzialność”
2. `docs/briefs/EMB-00-overview.md` — binding epiku po decyzji 21.10 (bez sztucznych bliźniaków algorytmów w danych treningowych)

## Plan

### Step 0 — Kolejka pod nowy plan

- **Plik:** `docs/briefs/EMB-00-overview.md`, `docs/briefs/queue.json`, `docs/briefs/EMB-13-*.md`, `docs/briefs/EMB-14-*.md`, `docs/briefs/EMB-15-*.md`, `docs/briefs/EMB-10-targets-and-default.md`, `docs/briefs/README.md`
- **Zmiana:** EMB-12 = ten brief (zestaw testowy). Dalej: EMB-13 dane, EMB-14 trening + pojedynek baz, EMB-15 pełny trening/paczka/progi, EMB-10 pomiar + domyślny. Stary brief „bliźniaki algorytmów” anulowany decyzją maintainera.
- **Done when:** `npm run queue:validate` zielone; gates EMB-10 → EMB-15

### Step 1 — Pary z prawdziwego kodu w gicie

- **Plik:** `tools/emb/gold/real-refs.jsonl`, `tools/emb/gold/real-candidates.mts`, `tools/emb/gold/README.md`
- **Zmiana:** odnośniki (repo, commit, plik, linie, sha256) + etykiety `same` / `pattern` / `different` i część `validation` | `test`; bez kodu w gicie. Kandydaci dobierani po pasmach podobieństwa, nie tylko z góry rankingu.
- **Done when:** ≥ 200 par real; walidacja złota je liczy; README opisuje plik

### Step 2 — Trening omija funkcje zestawu

- **Plik:** `../dustmap-emb/data/check_leakage.py`
- **Zmiana:** bramka przecieku czyta też `real-refs.jsonl` (jak `private-refs.jsonl`) — żaden tekst treningowy / walidacyjny zbioru danych nie jest funkcją ze złota.
- **Done when:** `python ../dustmap-emb/data/check_leakage.py` przechodzi albo jasno wylicza przeciek; selftest dalej łapie podłożony przeciek

### Step 3 — Miernik: prawdziwy kod osobno

- **Plik:** `tools/emb/eval.mts`, `tools/emb/gold-data.mts`, `tools/emb/gold/validate.mjs`
- **Zmiana:** `emb:eval` wypisuje i zapisuje osobny wiersz dla par ze źródła prawdziwego kodu (obok `test` i `całość`); `emb:gold` ładuje `real-refs.jsonl`
- **Done when:** `npm run emb:gold` OK; `npm run emb:eval -- --selftest` OK; przebieg eval pokazuje zestaw „prawdziwy”

## Constraints

- Kod prywatny tylko jako odnośniki + sha256 — nigdy treść w gicie
- Nie dodawać sztucznych par „inny algorytm” / mutantów do danych treningowych (to EMB-13 usuwa, nie ten brief dodaje)
- Pliki spoza scope — zakaz (m.in. usuwanie jscpd, `model pull` zostają na później)

## Pliki (scope)

- `docs/briefs/EMB-00-overview.md`, `docs/briefs/EMB-10-targets-and-default.md`, `docs/briefs/EMB-12-independent-implementations.md`, `docs/briefs/EMB-13-*.md`, `docs/briefs/EMB-14-*.md`, `docs/briefs/EMB-15-*.md`, `docs/briefs/queue.json`, `docs/briefs/README.md`
- `tools/emb/**`
- `../dustmap-emb/data/check_leakage.py`
- `docs/experiments/emb-results.md` (tylko gdy eval dopisuje wiersz)

## Weryfikacja

```bash
npm run emb:gold
node tools/emb/gold/validate.mjs --selftest
npm run emb:eval -- --selftest
npm run queue:validate
npm run verify
```

## Wyjście (acceptance)

- [ ] Kolejka i overview zgodne z nowym planem
- [ ] ≥ 200 par `real-refs`, walidacja i przeciek je widzą
- [ ] Miernik raportuje „prawdziwy” osobno

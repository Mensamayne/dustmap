# CON-04 — Korpus: kod do nauki

**Queue:** `CON-04` | **Epic:** CON | **Segment:** semantic | **Layer:** 2

## Overview

Potok danych ma dość różnorodnego kodu, żeby nauczyć model koncepcji, a nie stylu jednego repo. Źródła to prywatne cele (Monorepo-A, Service-B, sam Dustmap) i otwarte repo TS/JS/CSS na wolnych licencjach z pełną historią gita. Każde źródło jest przypięte do commita, ma licencję i wpis w rejestrze pobrań.

## Read first

1. `../dustmap-emb/data/sources.json`, `../dustmap-emb/data/corpus.mjs`, `../dustmap-emb/data/clean-corpus.mjs`
2. `../dustmap-emb/DATA-CARD.md` — obecne źródła
3. `docs/TEST-TARGETS.md` — zasady migawek celów

## Plan

### Step 1 — Wybór otwartych repo

- **Plik:** `../dustmap-emb/data/sources.json`
- **Zmiana:** ok. 30–60 repo. Kryteria: licencja MIT/Apache-2.0/BSD; TS/JS z klasami i CSS (aplikacje, nie tylko biblioteki); ≥ 1000 commitów (historia dla CON-05); mieszanka: frontend z CSS, backend, monorepo, narzędzia CLI. Każde z przypiętym commitem i licencją.
- **Done when:** lista z uzasadnieniem kryteriów w karcie danych; licencje sprawdzone w plikach LICENSE, nie z opisu

### Step 2 — Pobranie i czyszczenie

- **Plik:** `../dustmap-emb/data/corpus.mjs`, `../dustmap-emb/data/clean-corpus.mjs`
- **Zmiana:** klony na dysku E (`E:\dustmap-emb-data`). Wycięte: wygenerowany kod, `dist/`, zminifikowane pliki, vendor, pliki z odciskami skompilowanego kodu. Cięcie na jednostki wyłącznie przez CON-02. Deduplikacja jednostek po odcisku między repo.
- **Done when:** raport korpusu: repo, jednostki per rodzaj (funkcja / fragment / klasa / CSS), rozmiar na dysku

### Step 3 — Rejestr

- **Plik:** `docs/experiments/emb-results.md`, `../dustmap-emb/DATA-CARD.md`
- **Zmiana:** każde pobranie: repo, commit, licencja, data, rozmiar
- **Done when:** rejestr kompletny dla wszystkich źródeł

## Constraints

- Cele tylko do odczytu, przez migawki; zero zapisów w ich repo
- Bez repo bez jasnej licencji

## Pliki (scope)

- `../dustmap-emb/data/**`, `../dustmap-emb/DATA-CARD.md`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
node ../dustmap-emb/data/corpus.mjs --report
```

## Wyjście (acceptance)

- [ ] Źródła przypięte, z licencjami, w rejestrze
- [ ] Raport jednostek per rodzaj i per repo

## Po zakończeniu

1. Commit `Fixes CON-04: …` (w `dustmap-emb`; w dustmap tylko emb-results)
2. `node tools/queue/close.mjs --id CON-04 --note "…"`

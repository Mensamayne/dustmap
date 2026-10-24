# CON-13 — Dane naprawdę w skali: historia otwartych repo, generator, klony

**Queue:** `CON-13` | **Epic:** CON | **Segment:** semantic | **Layer:** 7

## Overview

Zbiór treningowy ma tysiące, a nie setki prawdziwych przykładów `contains`, `concept` i `same`. Audyt po CON-11 (24.10.2026) pokazał, że tak nie jest:
- poza przepisanymi kopiami trening miał ok. 5,4 tys. pozytywów;
- wzrost funkcji zbierano z 800 commitów kilku repo;
- wydzielenie i scalenie tylko z prywatnych celów (159 i 605 par);
- generator modelem językowym nie ruszył (464 pary z prostych przekształceń);
- klony kopiuj-wklej tylko z prywatnych raportów (153).

47 pobranych otwartych repo prawie nie zostało użytych.

## Read first

1. `../dustmap-emb/DATA-CARD.md` § CON-04..CON-08
2. `../dustmap-emb/data/history/{grow,extract-refactor,merge-move,io}.mjs`, `thresholds.mjs`
3. `../dustmap-emb/data/generate/{llm,ops,verify,run}.mjs`
4. `../dustmap-emb/data/clones/pairs.mjs`

## Plan

### Step 1 — Wydobywacze historii: szybkość

- **Plik:** `../dustmap-emb/data/history/io.mjs` i wydobywacze
- **Zmiana:** zmierzyć, gdzie idzie czas (react: 800 commitów w 20 min). Czytanie przez jeden długo żyjący `git cat-file --batch` na repo, cięcie tylko zmienionych plików, praca równoległa na repo (procesy). Cel: pełna historia jednego dużego repo w ≤ 15 min.
- **Done when:** czas na react przy pełnej historii zapisany; selftesty bez zmian

### Step 2 — Historia wszystkich otwartych repo

- **Plik:** `../dustmap-emb/data/history/*.mjs`, `../dustmap-emb/data/dataset.json`
- **Zmiana:** grow / extract / merge-move na wszystkich 47 klonach, bez limitu 800 commitów (limit czasu na repo zapisany w karcie). Klony z historią obciętą przez `--filter` uzupełnić (`git fetch --refetch` w kopii na E:, nie w repo celu).
- **Done when:** liczby per repo i per rodzaj w karcie; przegląd 50 losowych par per rodzaj ≥ 90% (sam przegląd, z zapisem werdyktów)

### Step 3 — Klony kopiuj-wklej z otwartych repo

- **Plik:** `../dustmap-emb/data/clones/pairs.mjs`
- **Zmiana:** skan Dustmapa (tylko adapter jscpd) na każdym klonie do katalogu na E:, potem pary jak dziś dla prywatnych
- **Done when:** liczba par klonów publicznych w karcie

### Step 4 — Generator modelem językowym

- **Plik:** `../dustmap-emb/data/generate/llm.mjs`, `run.mjs`, `docs/experiments/emb-env.md`
- **Zmiana:** lokalny Qwen2.5-Coder-Instruct (Apache-2.0, safetensors). Rozmiar dobrany do wolnej pamięci karty (7B w 4 bitach albo 3B w bf16). Wpis w rejestrze pobrań. Operacje z CON-06 (rozbudowa → `contains`, rozkład → `concept`, inny algorytm → `same`, zmiana zadania → `pattern`) na jednostkach publicznych i prywatnych, z weryfikacją z `verify.mjs`.
- **Done when:** ≥ 5000 par po weryfikacji; odsetek odrzuceń i przegląd 30 per operacja w karcie

### Step 5 — Przebudowa i bramki

- **Plik:** `../dustmap-emb/data/build_dataset.py`, `../dustmap-emb/data/dataset.json`, `../dustmap-emb/DATA-CARD.md`
- **Zmiana:** zbiór z nowymi źródłami; przepisane kopie ≤ 40% pozytywów (wybór w budowie, nie dopiero w treningu); bramki CON-08 i przypięcie CON-09
- **Done when:** pozytywy bez przepisanych kopii ≥ 25 000, w tym `contains` ≥ 8 000 i `concept` ≥ 3 000; bramki zielone; pin zapisany

## Constraints

- Prywatny kod nigdy poza ten komputer; generator lokalny
- Cele tylko do odczytu; klony na E: to nasze kopie
- Każde pobranie w `emb-env.md` / `emb-results.md` z wersją i licencją
- Uczenie (aktualizacja wag) tylko na GPU — generator to nie uczenie, ale też wymaga karty

## Pliki (scope)

- `../dustmap-emb/data/**`, `../dustmap-emb/DATA-CARD.md`, `docs/experiments/emb-results.md`, `docs/experiments/emb-env.md`

## Weryfikacja

```bash
E:/dustmap-emb-data/venv/Scripts/python.exe ../dustmap-emb/data/check_labels.py
E:/dustmap-emb-data/venv/Scripts/python.exe ../dustmap-emb/data/check_leakage.py
E:/dustmap-emb-data/venv/Scripts/python.exe ../dustmap-emb/data/pin_dataset.py --variant private --verify
```

## Wyjście (acceptance)

- [ ] Historia i klony ze wszystkich otwartych repo
- [ ] Generator lokalny działa, pary zweryfikowane
- [ ] Progi liczby pozytywów spełnione, bramki zielone

## Po zakończeniu

1. Commit `Fixes CON-13: …` (osobno w `dustmap-emb`)
2. `node tools/queue/close.mjs --id CON-13 --note "…"`

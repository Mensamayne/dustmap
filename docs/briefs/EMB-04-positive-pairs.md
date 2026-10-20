# EMB-04 — Dane: pary „ten sam sens”

**Queue:** `EMB-04` | **Epic:** EMB | **Segment:** semantic | **Layer:** 4

## Overview

Model uczy się, że kod może wyglądać inaczej i znaczyć to samo. Potrzebuje dziesiątek tysięcy takich par — bez ręcznego etykietowania, z trzech pewnych źródeł.

## Plan

### Step 1 — Przekształcenia bez zmiany sensu (syntetyczne, publiczne)

- **Plik:** `../dustmap-emb/data/rewrite/` (generator na drzewie składni TS — biblioteka TypeScript, nie wyrażenia regularne)
- **Zmiana:** zmiana nazw zmiennych i funkcji; `for` ↔ `for…of` ↔ `forEach` ↔ `reduce` / `map` / `filter` (gdy bez efektów ubocznych); wczesny `return` ↔ `if/else`; strzałka ↔ `function`; `async/await` ↔ `.then`; wydzielenie zmiennej pomocniczej; zmiana kolejności niezależnych instrukcji; `switch` ↔ mapa obiektu. Każde przekształcenie ma test: wynik się kompiluje i (dla czystych funkcji) daje te same wyniki na losowych wejściach
- **Done when:** ≥ 30 tys. par z kodu o wolnej licencji + syntetycznego; raport, ile par odrzucono jako niekompilujące się

### Step 2 — Historia git (prywatne, tylko model prywatny)

- **Plik:** `../dustmap-emb/data/history/`
- **Zmiana:** ta sama funkcja przed i po commicie typu „refactor” (zmieniony zapis, te same testy zielone przed i po); funkcja przeniesiona między plikami. Repo maintainera z klonów w `../dustmap-lab/arena/poligon/` (źródła tylko do odczytu)
- **Done when:** liczba par per repo; zero par z commitów „fix” (te zmieniają zachowanie — idą do EMB-05)

### Step 3 — Kopie z innymi literałami

- **Plik:** `../dustmap-emb/data/clones/`
- **Zmiana:** klastry jscpd (DUST-04) jako łatwe pozytywy, z wagą niższą niż powyższe
- **Done when:** proporcje źródeł zapisane w karcie danych

## Constraints

- Zero przecieku: pary ze zbioru wzorcowego (EMB-01) i ich funkcje wycięte po odciskach treści
- Podział trening / walidacja **po repo i po pliku**, nie losowo po parach
- Dane prywatne nigdy w danych modelu publicznego

## Pliki (scope)

- `../dustmap-emb/data/**`, `../dustmap-emb/DATA-CARD.md`

## Weryfikacja

```bash
python ../dustmap-emb/data/check_leakage.py
```

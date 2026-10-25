# CON-05 — Pary z historii gita: wzrost, wydzielenie, scalenie, przeniesienie

**Queue:** `CON-05` | **Epic:** CON | **Segment:** semantic | **Layer:** 3

## Overview

Historia gita to najlepsze źródło prawdziwych przykładów. Funkcja urosła o nowy krok → `contains`. Kawałek wyjęty z długiej funkcji do nowej → `contains` (fragment ↔ nowa funkcja). Dwie funkcje scalone w jedną → `same` lub `concept`. Kod przeniesiony do innego pliku → `same`. Poprawka błędu → `same` (już jest z EMB-13). Przy scaleniach zapisujemy też, ile linii i testów zniknęło. To dane do v2, których teraz nie używamy.

## Read first

1. `../dustmap-emb/data/history/mine.mjs` — obecne wydobycie z historii (EMB-04/13)
2. `docs/briefs/CON-00-overview.md` § Definicja
3. `packages/core/src/semantic/units.ts` — jednostki (CON-02)

## Plan

### Step 1 — Wzrost funkcji (`contains`)

- **Plik:** `../dustmap-emb/data/history/grow.mjs` (nowy)
- **Zmiana:** ta sama funkcja (ten sam plik + nazwa albo śledzenie przeniesienia) w dwóch commitach, gdzie nowa wersja zawiera prawie cały stary kod (wspólne linie ≥ 80% starej) i dodaje ≥ 20% nowego. Para (stara, nowa) z `larger` = nowa. Odrzucić sam wzrost przez formatowanie.
- **Done when:** losowe 50 par przejrzane ręcznie, ≥ 90% poprawnych; wynik w karcie danych

### Step 2 — Wydzielenie (`contains`)

- **Plik:** `../dustmap-emb/data/history/extract-refactor.mjs` (nowy)
- **Zmiana:** commit, w którym z funkcji A znika ciąg instrukcji, a w tym samym commicie pojawia się funkcja B z tym kodem (podobieństwo tekstu po normalizacji). Pary: (fragment starej A, B) jako `same`; (stara A, B) jako `contains` z `larger` = A.
- **Done when:** przegląd 50 par ≥ 90%

### Step 3 — Scalenie i przeniesienie

- **Plik:** `../dustmap-emb/data/history/merge-move.mjs` (nowy)
- **Zmiana:** scalenie: commit usuwa funkcję lub klasę X, a jej wywołania przechodzą na Y, która istniała wcześniej → (X przed usunięciem, Y) jako `same` albo `concept` (`concept`, gdy kształt mocno inny). Zapisać metadane v2: linie usunięte, pliki testów usunięte lub zmienione. Przeniesienie: jednostka znika z pliku A i pojawia się w B prawie bez zmian → `same`.
- **Done when:** przegląd 50 par scaleń ≥ 85%; metadane v2 w osobnym pliku, nie w zbiorze treningowym

### Step 4 — Klasy w historii

- **Plik:** `../dustmap-emb/data/history/grow.mjs`, `../dustmap-emb/data/history/merge-move.mjs`
- **Zmiana:** te same reguły dla klas: klasa urosła o metody → `contains`; klasa zastąpiona inną → `concept`
- **Done when:** pary klas policzone w raporcie potoku

## Constraints

- Tylko odczyt historii (`git log`, `git show`); zero zapisów w repo źródłowych
- Pary z jednostek zestawu testowego odrzucane już tutaj (bramka i tak w CON-08)
- Progi to parametry z jednym miejscem definicji, opisane w karcie danych

## Pliki (scope)

- `../dustmap-emb/data/history/**`, `../dustmap-emb/data/dataset.json`, `../dustmap-emb/DATA-CARD.md`

## Weryfikacja

```bash
node ../dustmap-emb/data/history/grow.mjs --selftest
node ../dustmap-emb/data/history/extract-refactor.mjs --selftest
node ../dustmap-emb/data/history/merge-move.mjs --selftest
```

## Wyjście (acceptance)

- [ ] Wydobywacze z selftestami na sztucznym repo
- [ ] Ręczne przeglądy zapisane z wynikiem
- [ ] Liczby par per rodzaj w karcie danych

## Po zakończeniu

1. Commit `Fixes CON-05: …`
2. `node tools/queue/close.mjs --id CON-05 --note "…"`

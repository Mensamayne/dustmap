# Dane treningowe modelu „ten sam sens” (EMB-04, EMB-05)

**Stan:** gotowe 21.10.2026. Pełny opis — źródła, liczby, przeglądy ręczne, znane ograniczenia: [`dustmap-emb/DATA-CARD.md`](../../../dustmap-emb/DATA-CARD.md). Kod: `dustmap-emb/data/`. Dane (nie w gicie): `E:\dustmap-emb-data\data`.

## W skrócie

- **Pary „ten sam sens”** — trzy źródła: przekształcenia bez zmiany sensu na drzewie składni (20 rodzajów, czyste funkcje sprawdzane uruchomieniem), historia git repo maintainera (tylko gdy dwie wersje różnią się wyłącznie nazwami i typami), kopie kodu z klastrów kopiuj-wklej Dustmapa. Publiczne + syntetyczne: 55 674 par (cel ≥ 30 tys.).
- **Trudne negatywy** — ten sam wstęp / ta sama fabryka / ten sam podpis portu, a inna logika (13 372 par, cel ≥ 10 tys.; 49 z 50 trafnych w przeglądzie ręcznym), ta sama nazwa i inna treść, poprawki błędów z historii, mapowania odwrotne.
- **Zbiór** w dwóch wariantach (trening / walidacja, trójki: publiczny 55 023 / 8 522, prywatny 207 311 / 25 288): `public` (tylko kod o wolnej licencji i syntetyczny) i `private` (z kodem maintainera). Podział trening / walidacja po repo i pliku. Każdy pozytyw ma 1–3 trudne negatywy.
- **Przeciek**: `py dustmap-emb/data/check_leakage.py` — zbiór wzorcowy nietknięty, kod prywatny tylko w wariancie prywatnym, walidacja rozłączna z treningiem; bramka sama sprawdza, że łapie podrzucony przeciek (`--selftest`).

## Decyzje, które warto znać przed treningiem (EMB-06)

- **Historia git bez uruchamiania testów.** Brief chciał „te same testy zielone przed i po”, ale skryptów repo docelowych nie wolno uruchamiać (`docs/TEST-TARGETS.md`). Ręczny przegląd pokazał, że ok. połowa par z commitów „refactor” zmienia działanie, więc dowodem jest równość kształtu (`dustmap-emb/data/lib/shape.mjs`), nie klasa commita. Zero par z commitów „fix”.
- **„Fixes ABC-12: …” to nie naprawa błędu** — to konwencja zamykania zadań; klasyfikowany jest temat po identyfikatorze.
- **Bliźniaki z budowania** (źródło `.ts` i skompilowany `.js` tej samej funkcji w jednym pakiecie) nigdy nie są negatywami — to po nich jedyny błąd w przeglądzie 50 par wzorców.
- **Dane syntetyczne tam, gdzie prawdziwego kodu jest za mało**: głębokie przekształcenia pętli, wzorce „ten sam wstęp, inna logika”, mapowania odwrotne. Każda syntetyczna para negatywna jest uruchomiona i zostaje tylko, gdy wyniki się różnią.
- **Etykiety słabe** (naprawa, ta sama nazwa, kopie) mają niższe wagi w `dustmap-emb/data/dataset.json`.

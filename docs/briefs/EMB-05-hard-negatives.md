# EMB-05 — Dane: trudne negatywy i wzorce

**Queue:** `EMB-05` | **Epic:** EMB | **Segment:** semantic | **Layer:** 5

## Overview

Najczęstszy fałszywy alarm z pomiaru DUST-15 to nie szum, tylko **wzorzec**: wstępy handlerów akcji, deklaracje `defineAction({...})`, adaptery jednego portu, fabryki magazynów. Model ma się nauczyć, że „wygląda podobnie” ≠ „robi to samo”.

## Plan

### Step 1 — Wzorce

- **Plik:** `../dustmap-emb/data/negatives/patterns.py`
- **Zmiana:** pary funkcji z tym samym szkieletem (ten sam wstęp, to samo wywołanie fabryki z obiektem konfiguracyjnym, ta sama sygnatura portu) i różną logiką dalej — wykrywane ogólnie (drzewo składni: wspólny prefiks instrukcji, różny ogon), bez list nazw
- **Done when:** ≥ 10 tys. par; próbka 50 sprawdzona ręcznie (wynik w karcie danych)

### Step 2 — Ta sama nazwa, inna logika; zmiana zachowania

- **Plik:** `../dustmap-emb/data/negatives/`
- **Zmiana:** (a) funkcje o tej samej nazwie w różnych modułach z różną treścią; (b) funkcja przed i po commicie „fix”, gdy zmienia się zachowanie (inne wyniki testów) — bardzo podobny tekst, inny sens; (c) odwrotne mapowania (DUST-15 #17)
- **Done when:** liczby per typ w karcie danych

### Step 3 — Mieszanie w batchu

- **Plik:** `../dustmap-emb/data/build_dataset.py`
- **Zmiana:** każdy przykład pozytywny ma 1–3 trudne negatywy; proporcje konfigurowalne
- **Done when:** zbiór gotowy w formacie treningu (EMB-06)

## Constraints

- Te same zasady przecieku i podziału co EMB-04
- Reguły ogólne, bez wiedzy o konkretnym projekcie

## Pliki (scope)

- `../dustmap-emb/data/**`, `../dustmap-emb/DATA-CARD.md`

## Weryfikacja

```bash
python ../dustmap-emb/data/check_leakage.py
```

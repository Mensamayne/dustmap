# CON-11 — Trening modelu v2 i porównanie z poprzednim

**Queue:** `CON-11` | **Epic:** CON | **Segment:** semantic | **Layer:** 6

## Overview

Na danych z CON (paczka z CON-09) trenujemy **prywatny model v2** (kolejna generacja po EMB-15). Potem mierzymy go na tym samym zestawie wzorcowym v2 co bazę i **jawnie porównujemy** z modelem z EMB-15: gdzie jest lepiej, gdzie gorzej, czy wolno go ustawić jako nowy domyślny do skanu.

## Read first

1. `docs/briefs/CON-09-dataset-and-baseline.md` — paczka i wynik bazowy
2. `docs/briefs/EMB-15-full-train-pack-calibrate.md` — przepis treningu / ONNX / progi
3. `docs/experiments/emb-results.md` — liczby EMB-15 i CON-09
4. `docs/briefs/CON-00-overview.md` — etykiety, jednostki, zakaz wycieku testu do treningu

## Plan

### Step 1 — Trening v2 na nowych danych

- **Plik:** `../dustmap-emb/configs/*.yaml`, przebiegi w `E:\dustmap-emb-data\runs`
- **Zmiana:** pełny trening na zbiorze z CON-09 (tylko `train` / `validation`). Uwzględnić słabości z pomiaru bazowego (np. strata / próbkowanie pod `contains`, klasy, CSS), jeśli da się to zapisać ogólnie — bez ręcznych list wyjątków. Checkpoint wybierać po AP / metrykach na walidacji i na złocie walidacyjnym, **nie** na teście.
- **Done when:** checkpoint v2 + `run.json` / manifest danych; powtarzalny przepis w emb-results

### Step 2 — Paczka i progi (jak EMB-15)

- **Plik:** `../dustmap-emb/export_onnx.py` (lub następca), `package.py`, `tools/emb/calibrate.mts`
- **Zmiana:** eksport ONNX (fp16 / int8 wag według limitu z EMB), kalibracja pasm na walidacji złota v2
- **Done when:** `verify_package` OK; `emb:calibrate` dla v2; wektory ONNX vs PyTorch w limicie

### Step 3 — Badanie względem poprzedniego modelu

- **Plik:** `tools/emb/eval.mts`, `docs/experiments/emb-results.md`
- **Zmiana:** ten sam protokół co CON-09 / EMB: AP oraz precyzja/wykrywalność przy progach, **osobno** per jednostka (funkcja, fragment, klasa, CSS) i per etykieta pozytywna (`same`, `contains`, `concept`). Tabela **obok siebie**: EMB-15 (baza) vs v2. Krótki werdykt po polsku: czy v2 wygrywa globalnie i na słabych miejscach bazy; czy zostaje nowym domyślnym prywatnym.
- **Done when:** tabela porównawcza w emb-results; decyzja „v2 domyślny / jeszcze nie” zapisana jednym zdaniem z liczbami

### Step 4 — Domknięcie epiku CON

- **Plik:** `docs/briefs/CON-00-overview.md`
- **Zmiana:** sekcja „Wynik epiku”: rozmiar danych, wynik bazy (CON-09), wynik v2 vs EMB-15, znane luki. Epik CON gotowy do Skan v2 (osobny epik produktu).
- **Done when:** overview mówi, że dane + model v2 są domknięte; brak otwartych briefów CON w kolejce

## Constraints

- Model prywatny nie trafia do gita ani poza ten komputer
- Zero strojenia pod część `test` złota; zero przecieku par testowych do treningu (bramki CON-08)
- Publiczny model / publikacja tylko jeśli maintainer odblokuje (patrz EMB-11); domyślnie tylko prywatny
- Bez ręcznie prowadzonych list wyjątków w przepisie treningu

## Pliki (scope)

- `../dustmap-emb/**`, `tools/emb/eval.mts`, `tools/emb/calibrate.mts`, `tools/emb/gold-data.mts`, `docs/experiments/emb-results.md`, `docs/briefs/CON-00-overview.md`

## Weryfikacja

```bash
npm run emb:eval -- --selftest
npm run emb:calibrate -- --model <id-v2>
npm run emb:eval -- --provider onnx --model <id-v2> --calibrated
npm run emb:eval -- --provider onnx --model <id-emb15> --calibrated
# porównanie liczb w emb-results (ta sama komenda / ten sam split test)
npm run verify
```

## Wyjście (acceptance)

- [ ] Checkpoint i paczka v2 na danych CON-09
- [ ] Tabela EMB-15 vs v2 per jednostka i etykieta w emb-results
- [ ] Werdykt: v2 lepszy / nie, i czy jest nowym domyślnym prywatnym
- [ ] Overview CON z wynikiem epiku

## Po zakończeniu

1. Commit `Fixes CON-11: …`
2. `node tools/queue/close.mjs --id CON-11 --note "…"`

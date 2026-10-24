# CON-12 — Naprawa miernika i zestawu testowego

**Queue:** `CON-12` | **Epic:** CON | **Segment:** semantic | **Layer:** 6

## Overview

Miernik pokazuje prawdziwą jakość modelu, a zestaw testowy nie karze go za poprawne odpowiedzi. Audyt po CON-11 (24.10.2026) znalazł pięć wad. Przez nie model z EMB-15 wypadał na 0,50 zamiast ok. 0,76, a wyniki dla `contains` i `concept` wychodziły na poziomie losu:

1. **AP per etykieta liczone źle.** Przy ocenie `contains` pary `same` i `concept` liczyły się jako negatywy. Wynik ≈ odsetek par danej etykiety, niezależnie od modelu.
2. **Pary zagnieżdżone w złocie.** 109 par „funkcja i funkcja w jej środku” oznaczonych `different`. Skan je pomija (`isNestedSpanPair`), więc nie należą do miary produktu. A według definicji nie są „różne”.
3. **Pułapka w głównej liczbie.** 194 pary `pattern` „siostry z jednego pliku” (EMB-10) zebrano z najwyżej ocenionych pomyłek wcześniejszego modelu. To cenna pułapka, ale dobrana pod jeden model. W głównym AP zniekształca porównanie modeli.
4. **Walidacja za mała.** 281 par (2 `concept`, 9 `contains`) przez podział „hash pliku % 3”. Na tym wybierano wersję modelu i liczono progi.
5. **CSS nie jest mierzone.** Migawka bierze tylko rozszerzenia z `include` w konfiguracji celu, więc pary CSS się nie wczytują.

## Read first

1. `tools/emb/metrics.mjs`, `tools/emb/eval.mts`, `tools/emb/calibrate.mts`, `tools/emb/gold-data.mts`
2. `tools/emb/gold/file-split.mjs`, `tools/emb/gold/validate.mjs`, `tools/emb/gold/check-hygiene.mts`
3. `../dustmap-emb/gold_meter.py` — miara wyboru wersji w treningu (musi liczyć tak samo)

## Plan

### Step 1 — AP per etykieta

- **Plik:** `tools/emb/metrics.mjs`, `tools/emb/eval.mts` (selftest), `../dustmap-emb/gold_meter.py`
- **Zmiana:** AP dla etykiety L = ranking tylko par L i negatywów (`pattern`, `different`). Inne pozytywy wypadają z tego wycinka.
- **Done when:** selftest: wyrocznia, która ocenia L wysoko, a inne pozytywy jeszcze wyżej, daje AP(L) = 1

### Step 2 — Pary zagnieżdżone poza złotem

- **Plik:** `tools/emb/gold/real-refs.jsonl`, `tools/emb/gold/check-hygiene.mts`
- **Zmiana:** usunąć pary, w których jedna strona leży w zakresie linii drugiej w tym samym pliku. Bramka higieny odrzuca takie pary na stałe (selftest).
- **Done when:** 0 par zagnieżdżonych; selftest higieny łapie podłożoną

### Step 3 — Pułapka osobno

- **Plik:** `tools/emb/gold/real-refs.jsonl` (pole `trap: true` na parach z EMB-10 siblings), `tools/emb/gold-data.mts`, `tools/emb/eval.mts`, `tools/emb/calibrate.mts`, `../dustmap-emb/gold_meter.py`
- **Zmiana:** pary z `trap` nie wchodzą do AP ani do kalibracji. Miernik raportuje je osobno: jaki odsetek ma wynik ≥ progu i ≥ `medium` (dla produktu: ile takich fałszywych alarmów przejdzie do raportu).
- **Done when:** eval wypisuje wiersz „pułapka”; główne zbiory bez par `trap`

### Step 4 — Podział bez przecieku i wyrównany

- **Plik:** `tools/emb/gold/file-split.mjs`, `tools/emb/gold/apply-file-split.mts`, `tools/emb/gold/validate.mjs`, `tools/emb/gold/real-refs.jsonl`, `tools/emb/gold/private-refs.jsonl`
- **Zmiana:** pliki połączone parami tworzą grupy; cała grupa idzie do jednej części. Grupy przydzielane deterministycznie, od największej, do części, która zbliża obie do 50/50 w każdej etykiecie. Walidacja pilnuje niezmiennika: żaden plik nie występuje w obu częściach.
- **Done when:** walidacja ma ≥ 40% par każdej etykiety pozytywnej; selftest walidacji łapie plik w obu częściach

### Step 5 — CSS i szybkie wczytywanie

- **Plik:** `tools/emb/gold-data.mts`
- **Zmiana:** gdy pliku nie ma w migawce, strona jest czytana z repo celu przez `git show <sha>:<ścieżka>` (tylko odczyt, ścieżka celu z `tools/targets/targets.json` / zmiennej środowiskowej). Sprawdzenie sha256 bez zmian. Pliki czytane raz (pamięć podręczna w procesie).
- **Done when:** 0 par pominiętych przez brak pliku; wczytanie złota < 30 s

### Step 6 — Wyrywkowa kontrola etykiet

- **Plik:** `docs/experiments/emb-results.md`, `tools/emb/gold/real-refs.jsonl`
- **Zmiana:** losowe 80 par (stratyfikacja po etykiecie i źródle) przeczytać i ocenić według README, bez patrzenia na etykietę i wynik modelu. Policzyć zgodność. Błędne etykiety poprawić z powodem w `why`. Przy zgodności < 85% przejrzeć całą etykietę, która zawodzi.
- **Done when:** zgodność i poprawki zapisane w emb-results

### Step 7 — Nowe liczby

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** EMB-15 i CON-11 zmierzone poprawionym miernikiem. PAIR nie jest kandydatem: jego głowa mapuje `contains` i `concept` na „nie duplikat”, wbrew definicji CON-00 — w emb-results tylko adnotacja.
- **Done when:** tabela w emb-results; stare liczby CON-09/CON-11/PAIR oznaczone jako liczone wadliwym miernikiem

## Constraints

- Prywatny kod nigdy w gicie; tylko odnośniki + sha256
- Cele tylko do odczytu (`git show` to odczyt; zero zapisów, zero ich skryptów)
- Nie osłabiać selftestów; naprawiać miarę

## Pliki (scope)

- `tools/emb/**`, `../dustmap-emb/gold_meter.py`, `docs/experiments/emb-results.md`, `docs/briefs/CON-12-meter-and-gold-repair.md`, `docs/briefs/queue.json`, `docs/briefs/README.md`

## Weryfikacja

```bash
npm run emb:gold
npm run emb:eval -- --selftest
node tools/emb/gold/validate.mjs --selftest
npx tsx tools/emb/gold/check-hygiene.mts --selftest
npm run verify
```

## Wyjście (acceptance)

- [ ] AP per etykieta liczone względem negatywów
- [ ] Zero par zagnieżdżonych; pułapka raportowana osobno
- [ ] Walidacja ≥ 40% każdej etykiety pozytywnej, bez przecieku plików
- [ ] CSS mierzone
- [ ] Kontrola 80 par zapisana; nowe liczby EMB-15 / CON-11 / PAIR

## Po zakończeniu

1. Commit `Fixes CON-12: …`
2. `node tools/queue/close.mjs --id CON-12 --note "…"`

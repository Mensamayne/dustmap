# Wyniki: „ten sam sens” na zbiorze wzorcowym (EMB)

## CON-11: trening v2 vs EMB-15 (23.10.2026)

Przepis: W2 z checkpointu EMB-15 (`private-w2-20261022-0107/best`), dane CON-09 (pin), wybór po **AP na prawdziwym kodzie tylko walidacja** (`apRealVal`, etykiety same+contains+concept). Miernik treningu: `gold_meter.py`.

| Przebieg | train rows | best step | apRealVal | apTest (gold meter) | contains/concept AP test |
|----------|----------:|----------:|----------:|--------------------:|--------------------------|
| surowa W2 (abort) | 57 963 | 0 | 0,411 | 0,562 | 0,059 / 0,031 |
| + EMB-15 init, rewrite 35% | 13 081 | 0 (=EMB-15) | 0,326 | 0,514 | 0,052 / 0,030 |
| + EMB-15 init, **bez rewrite** | 8 503 | **200** | **0,328** | 0,490 | 0,056 / 0,029 |

Douczanie na parach CON nie podnosi rankingu na złocie v2 względem startu EMB-15 (różnica apRealVal < 0,01). Contains/concept zostają ~0,05. ONNX baza CON-09 (EMB-15): AP test **0,499**.

**Werdykt jakości:** na złocie v2 v2 **nie przebija** EMB-15 (AP test ONNX int8 ~0,49 vs baza CON-09 ~0,50). Domyślny produkt może zostać przy EMB-15, ale **paczka CON-11 jest gotowa** (wcześniej błędnie zatrzymano się na checkpoincie).

**Paczka (23.10.2026, dogrywka):** `dustmap-same-meaning-private-con11` v0.4.0-con11 — CPU int8 ~138 MB, GPU fp16 ~275 MB, `verify_package` OK, kalibracja zapisana w manifeście. Lokalnie: `~/.cache/dustmap/models/dustmap-same-meaning-private-con11` oraz `dustmap-emb/dist/…`. Checkpoint źródłowy: `runs/private-w2-con11-norewrite-20261023-0830/best`.

### Monorepo-A: EMB-15 vs CON-11 (migawka `dbe35aa00cd6`)

Dwa skany CLI na tej samej migawce (`dustmap scan … --commit dbe35aa…`), exit 0. Różni się tylko model semantyczny.

| | EMB-15 (`dustmap-same-meaning-private`) | CON-11 (`…-private-con11`) |
|--|--:|--:|
| znaleziska łącznie | 11 511 | 10 609 |
| semantic-duplicate | **1034** (high 603 · medium 407 · low 24) | **132** (high 109 · medium 23 · low 0) |
| wspólne odciski semantic | 61 | 61 |
| tylko ten model | 973 | 71 |
| dead-code / duplicate / … | bez zmian (te same nie-semantyczne) | bez zmian |

CON-11 ma ostrzejsze pasma kalibracji (high ≥ ~0,97), więc na produkcie zgłasza **dużo mniej** par „ten sam sens”. To nie znaczy „lepszy ranking na złocie” (tam EMB-15 nadal minimalnie wyżej) — znaczy: mniej hałasu w raporcie skanu, ale też mniej wykryć. Domyślny produkt: zostawić EMB-15, dopóki nie będzie świadomej decyzji „wolimy cichszy skan”.

## CON-09: paczka danych + baza EMB-15 na złocie v2 (23.10.2026)

Prywatny zbiór przypięty: `E:\dustmap-emb-data\data\dataset\private\pin.json` (SHA-256 plików train/validation + wejść). `py data/pin_dataset.py --verify` → OK.

Miernik: `npx tsx tools/emb/eval.mts --provider onnx --model dustmap-same-meaning-private --device cpu --calibrated` (EMB-15). Złoto v2: 1539 par (1397 prywatnych); **102 pary CSS** nie ładują się z migawki `monorepo-a@dbe35aa00cd6` (pliki poza `git archive` — osobna higiena).

| Zbiór | Par | AP | same / contains / concept (AP) | function / fragment / class / mixed (AP) | Precyzja high / ≥medium | Wykrywalność ≥medium |
|-------|----:|---:|---|---|---|---|
| test | 1258 | **0,499** | 0,467 / 0,051 / 0,030 | 0,469 / 0,759 / 0,748 / 0,504 | 0,386 / 0,393 | 0,392 |
| prawdziwy | 1374 | 0,466 | 0,451 / 0,049 / 0,027 | 0,435 / 0,740 / 0,737 / 0,508 | 0,323 / 0,340 | 0,440 |

**Wniosek.** Na nowym złocie model z EMB-15 traci ranking: AP test ~0,50 (wcześniej ~0,74 na starym, węższym teście). Najsłabsze etykiety: **contains** i **concept** (AP ~0,05). Jednostki fragment/klasa wyglądają lepiej w AP niż funkcje, ale to często łatwiejsze pary `same`. Cele EMB-09 na teście: nie spełnione. CON-11 ma podnieść contains/concept i utrzymać same.

## CON-08: bramki zbioru (23.10.2026)

Selftesty: `check_labels` / `check_leakage` (w tym zawieranie) / `check_balance` — czerwone na podłożonych błędach. Budowa filtruje przeciek fragmentów ze zbioru testowego i ucina źródła > 50% (synthetic zwolniony). Po przebudowie: etykiety OK, przeciek 0, bilans OK. Karta: `dustmap-emb/DATA-CARD.md` § CON-08.

## CON-07: trudne negatywy (23.10.2026)

Siostry EMB-10: 201× `pattern` do seed, 189 w `real-refs` ( emb:gold OK, 1499 prywatnych). Minery: concept (caller/sibling/fragment), class-shape, CSS same-props, gold-sibling. `check_labels.py` bez sprzeczności. Odłożone: 1 para bez ciała na migawce.

## CON-06: pary generowane (23.10.2026)

Kontrolowane operacje na jednostkach korpusu (AST, bez LLM w tej iteracji — brak wag codegen w cache; `llm.mjs` + rejestr propozycji Qwen2.5-Coder-1.5B). **464** par po `verify` (expand/contains, decompose/concept, css-equiv/same, pattern-trap). Limit ≤ 2 warianty / jednostka; udział generowanych ≤ 40% pozytywów (dataset.json). Selftest verify OK.

## CON-05: pary z historii (23.10.2026)

Wydobywacze na prywatnych celach (Monorepo-A + poligon): wzrost funkcji/klas → `contains` (**1648**), wydzielenie helpera (**159**), przeniesienie / scalenie (**605**, w tym 247 `moved` i 358 `merge` z etykietą `same`|`concept`). Progi: `dustmap-emb/data/history/thresholds.mjs`. Selftesty na sztucznym repo: OK. Przegląd 50 losowych: grow 98%, extract/merge 100%. Metadane v2 merge poza treningiem. Otwarte klony: opcjonalnie `--limit-public` (partial clone spowalnia `cat-file`).

## CON-04: korpus otwartych klonów (23.10.2026)

Na `E:\dustmap-emb-data` leży **47** otwartych repo TS/JS/CSS (MIT / Apache-2.0 / BSD-3-Clause), każde z przypiętym tipem i licencją odczytaną z dysku (`data/fetch-open-clones.mjs`, rejestr `clone-registry.jsonl`). Pominięte: `date-fns` (monorepo root bez pliku LICENSE / pola licence). Kryteria: wolna licencja, historia gita (min. 1388 commitów, mediana 6985), mieszanka aplikacji z CSS, bibliotek i CLI.

Cięcie wyłącznie przez wspólne jednostki Dustmapa (CON-02). Raport `corpus-report.json`:

| Widoczność | Jednostki | funkcja | fragment | klasa | CSS | Funkcji (legacy JSONL) |
|------------|----------:|--------:|---------:|------:|----:|-----------------------:|
| publiczne (npm + 47 klonów) | 227 933 | 144 702 | 52 554 | 17 442 | 13 235 | 144 702 |
| prywatne (cele + poligon) | 59 937 | 32 634 | 18 308 | 805 | 8 190 | 32 634 |

Pliki: `units-{public,private}.jsonl`, `functions-{public,private}.jsonl`. Karta: `dustmap-emb/DATA-CARD.md`. Komenda: `node dustmap-emb/data/corpus.mjs` (tsx z dustmapa).

## CON-03 goal (22.10.2026)

Cel zestawu testowego v2: **≥ 1200 kandydatów** → **≥ 800** ocenionych par z prawdziwego kodu. Kwoty docelowe po ocenie: 150 `contains`, 100 `concept`, 120 par klas, 100 CSS, 150 `pattern`. Skrypt: `tools/emb/gold/real-candidates.mts` → `.tmp/con03/candidates.json`. CSS: `git archive` pomija `.css`/`.scss`; dobrane z żywego Monorepo-A przez `git show` na tym samym SHA (`tools/emb/gold/add-css-candidates.mts`) — **180** par `css-css`, łącznie **1390** kandydatów.

### EMB-10 siostry w jednym pliku → złoto (22.10.2026)

Wpięte do `real-refs.jsonl` (**+114**, było **1463**): 9 par z ręcznego przeglądu + 105 zagnieżdżeń (helper w zakresie linii zewnętrznej → `different`). Źródło: `EMB-10 same-file siblings` — highy z poprzedniego modelu embeddingowego na Monorepo-A, ten sam plik, różne nazwy. Liczone w `emb:eval` jako zestaw prawdziwy (`isRealSource`). Poza złotem zostaje **202** kandydatów `needs-label` (propozycja `pattern`) na CON-07. Produkt jednocześnie pomija zagnieżdżone krawędzie w raporcie (`isNestedSpanPair`). Opis potoku: `tools/emb/gold/README.md` § Siostry.

### Higiena złota / CON-10 (22.10.2026)

**Rytuał:** po doleciu ≥ 50 par → przegląd ≥ 30 (krótkie fragmenty + nowe źródło) → wyrzut lub poprawka etykiety → notka tutaj → `npm run emb:gold`. Reguły: `tools/emb/gold/README.md` § Higiena; bramka: `check-hygiene.mts`.

Pierwszy przegląd po CON-03 + siostrach EMB-10: wyrzucone **22** pary (3 `contains`, 19 `different`). Zostaje **1441** w `real-refs`.

Wyrzucone id (dziennik): `bb49953ae5`, `ef97440f2e` (`.claude/skills`); `59c1e39360`, `8cdaa1f350`, `3f4d906892`, `20c8f136c9`, `255f8a7945`, `cf8ab2e1e8`, `cbf0e04e51`, `6cad81f427`, `b984493e6b`, `2807c18f23`, `54cff7e277` (trywialne lokale); `b3b67dbf32`, `a74306944b`, `babea0ec2a`, `4e7b880313`, `70583b8e69`, `d6f8143a1d`, `b6815ce930`, `10ed04fe5a`, `eaf24130ef` (backup / storyboard). Prefiks id: `real:monorepo-a:`.

### Przegląd sztuka po sztuce (zamknięty, 22.10.2026)

Pełny przejazd golda: każda para w `real-refs.jsonl` ma werdykt w `.tmp/gold-review/progress.json` (`keep` / `drop` / `relabel`). Batche short → concept → contains → CSS → EMB-10 → random.

| | |
|--|--:|
| przejrzane (klucze dziennika) | 1441 |
| wyrzucone w tej fali | ~158 |
| przeetykietowane | ~153 |
| zostaje w `real-refs` | **1287** |
| nieprzejrzane | **0** |

Po zamknięciu: `npm run emb:gold` → hygiene OK. Histogram etykiet w prywatnym zbiorze po przeglądzie: same 278 · contains 58 · pattern 357 · concept 57 · different 537.

### CON-03 zestaw v2 zamknięty (22.10.2026)

**1349** prywatnych par w `real-refs.jsonl` przed wpięciem siostr (241 CON-01 + 1108 nowych). Kandydaci: 1390 (w tym 180 CSS z `git show`). Podział `validation`/`test` po haśle **pliku** (`file-split.mjs`); selftest łapie przeciek. Druga niezależna ocena: zgodność **75,5%**, kappa **0,67**; wszystkie **332** rozbieżności rozstrzygnięte (główny oceniający, powód w `why`).

| | Po rozstrzygnięciach | Cel |
|--|--:|--:|
| razem | 1349 | ≥ 800 ✅ |
| `contains` | 117 | ≥ 150 ❌ (brak −33; z Monorepo-A/Service-B za mało prawdziwych rozbudowań; uzupełnienie → CON-04) |
| `concept` | 126 | ≥ 100 ✅ |
| `pattern` | 312 | ≥ 150 ✅ |
| pary klas | 189 | ≥ 120 ✅ |
| pary CSS | 160 | ≥ 100 ✅ |

`same` 270 · `different` 524. Skrypty: `second-opinion.mts`, `apply-file-split.mts`.

## CON-02: wspólne cięcie + parsery CSS (22.10.2026)

Pobrania (npm, licencje MIT): `css-tree@3.2.1`, `postcss@8.5.31`, `postcss-scss@4.0.9` w `@dustmap/core`. Jednostki: funkcja / fragment / klasa|obiekt / reguła CSS w `packages/core/src/semantic/units.ts`. Potok `dustmap-emb/data/lib/extract.mjs` woła to samo cięcie, limity 3–80 linii / 4000 znaków dopiero po cięciu.

## CON-01: nowa ocena 241 par (22.10.2026)

241 par z `tools/emb/gold/real-refs.jsonl` ocenione na nowo wg pięciu etykiet (CON-00): `same`, `contains`, `concept`, `pattern`, `different`. Kod czytany lokalnie z migawek; w gicie nadal tylko odnośniki. Źródło w pliku: `CON-01 relabel`.

| | Przed (3 etykiety) | Po (5 etykiet) |
|--|--:|--:|
| `same` | 77 | 52 |
| `contains` | — | 22 |
| `concept` | — | 7 |
| `pattern` | 58 | 70 |
| `different` | 106 | 90 |
| **zmieniona etykieta** | | **61** |

Główne przejścia: `same→contains` 14, `same→pattern` 13, `pattern→contains` 5, `different→pattern` 12, `different→concept` 4, `different→contains` 3, `same→concept` 2, `pattern→concept` 1. Wszystkie 22 `contains` mają `larger: "a"|"b"`. Walidacja złota i selftest miernika: OK.

## Dane EMB-13 (21.10.2026)

Zbiór treningowy przebudowany pod definicję odpowiedzialności: bez bliźniaków algorytmów i mutantów; poprawki `fix` jako pozytywy (975); rewrite ograniczony (waga 0,25, max 2 na kotwicę). Prywatny train: 81 134 trójek. Bramki przecieku i etykiet: 0 naruszeń. Szczegóły: `dustmap-emb/DATA-CARD.md`, `docs/experiments/emb-data.md`.

## Pojedynek baz EMB-14 (21.10.2026)

Przepis: 10% danych prywatnych, strata kontrastowa + BCE na parach (`pair_loss_weight` 0,5), checkpoint wybierany po **AP na prawdziwym kodzie** (241 par `EMB-12 real`), nie po stratach treningu. Bazy już zatwierdzone (bez nowego pobrania): W4 UniXcoder 126 M vs W2 CodeRankEmbed 137 M (MIT).

| Baza | AP prawdziwy (best) | AP test | Krok best | Minuty | Werdykt |
|------|--------------------:|--------:|----------:|-------:|---------|
| W4 `microsoft/unixcoder-base` | 0,748 | 0,748 | 150 | 8,7 | |
| **W2 `nomic-ai/CodeRankEmbed`** | **0,840** | **0,782** | 150 | 15,7 | **wygrywa → EMB-15** |

W2 zero-shot na prawdziwym kodzie już 0,821; po 10% douczeniu 0,840. W4 start 0,737 → best 0,748. Pełny trening EMB-15 na W2.

## Pełny trening i paczka EMB-15 (22.10.2026)

Pełne dane EMB-13, baza W2, strata kontrastowa + BCE na parach, checkpoint po AP na prawdziwym kodzie. Przebieg `private-w2-20261022-0107`: best przy kroku 250 (AP prawdziwy 0,844 / AP test 0,787 w mierniku treningowym, tylko etykieta `same`); dalsze kroki przeuczały (na końcu AP prawdziwy 0,736).

Paczka prywatna `dustmap-same-meaning-private` v0.3.0 w `dustmap-emb/dist/` (poza gitem): CPU int8 wag 138 MB, GPU fp16 275 MB (rotary embeddings zostają w fp32, inaczej ONNX Runtime nie wczytuje grafu). Eksport ONNX vs PyTorch: cosinus min 1,0 na 1000 funkcjach. Spadek AP int8 vs fp32 ≈ 0. Tokenizer W2 (`[PAD]`, `TemplateProcessing`) obsługiwany w Pythonie i w Node.

Po CON-01 miernik liczy AP na trzech etykietach pozytywnych (`same` + `contains` + `concept`). Na paczce ONNX int8 (CPU), z kalibracją:

| Zestaw | AP | Precyzja high | Precyzja ≥ medium | Wykrywalność ≥ medium |
|--------|---:|-------------:|------------------:|----------------------:|
| test | 0,743 | 0,905 | 0,833 | 0,235 |
| prawdziwy (241) | 0,771 | 0,933 | 0,850 | 0,420 |
| całość | 0,715 | 0,912 | 0,841 | 0,253 |

Progi (walidacja): high 0,812 / medium 0,787 / low 0,301. Cele EMB-09 na części test: spełnione. Szybkość CPU ~2,3 funkcji/s (16 wątków; model większy niż UniXcoder). Publiczna paczka nadal zablokowana (EMB-11).

## Pomiar i domyślny EMB-10 (22.10.2026)

Decyzja: domyślny dostawca `onnx`, model `dustmap-same-meaning-private` (lokalna paczka; publiczna nadal EMB-11). Ścieżka `jscpd --semantic` / `local` usunięta.

| Sprawdzenie | Wynik |
|-------------|-------|
| Lab pełny | 119 ✅ · 0 ❌ · 0 🟡 (scenariusz 03 bez znaczników EMB; próg labu 0,40 do rankingu, produkt raportuje od medium ~0,79) |
| Service-B migawka HEAD | skan 16,6 s · 8 grup semantic-duplicate |
| Monorepo-A `dbe35aa00cd6` | 1. skan 275 s · 2. skan 11 s (cache) · 1199 semantic-duplicate (796 high / 386 medium) |
| Próbka 30× high | ~23/30 prawdziwe kopie lub ta sama odpowiedzialność (~0,77); reszta to celowe wzorce (np. `generateMetadata`, scenariusze edge/happy). Cel ≥0,85 nieosiągnięty — wzorce nadal za często `high` |

Każdy wiersz to jeden przebieg `npm run emb:eval` na zbiorze z `tools/emb/gold` (EMB-01). Od CON-01 główna liczba **AP** traktuje `same` + `contains` + `concept` jako pozytywy; `pattern` i `different` to negatywy. „Brak wyniku” = dostawca w ogóle nie połączył pary (liczone jako 0). Zbiór `test` jest odłożony — nie trenujemy ani nie stroimy na nim progów.

## Wynik bazowy (21.10.2026, EMB-01)

Obecna droga produktu (jscpd `--semantic`, model `jina-embeddings-v2-base-code`), każda para mierzona osobno:

- **Model nie odróżnia „robi to samo” od „wygląda podobnie”.** Średnie podobieństwo par `same` (0,44) jest takie samo jak par `pattern` (0,45). Ranking jest niewiele lepszy od losu: AP 0,53 przy losie ~0,39.
- **Przy dzisiejszym progu 0,82 Dustmap znajduje 7% par „ten sam sens”** (zbiór `test`), z precyzją 60%. Ręcznie pisane pary z naprawdę innym zapisem (pętla vs `reduce`, klasa vs domknięcie) dostają 0,35–0,76 — wszystkie pod progiem.
- **Pary nad progiem to głównie przypadki z Monorepo-A**, gdzie dwie funkcje są kopią z innymi literałami (0,79–0,96). Najwyżej ocenione negatywy to też Monorepo-A: dwa adaptery jednego portu (0,96, `pattern`), wstępy handlerów (0,83–0,84) i odwrotne mapowania zgody (0,85).
- **42 ze 165 par nie dostało żadnego wyniku** — jscpd nie wyciął z nich jednostki (najczęściej krótkie funkcje strzałkowe i kod w wywołaniach `router.get(...)`, `bus.on(...)`). To też jest zachowanie produktu: takie duplikaty dziś są niewidoczne.
- Najlepszy możliwy próg dla tego modelu to 0,545 (F1 0,62) — ale wtedy przechodzi też większość wzorców. Strojenie progu nie naprawi braku rozróżnienia; potrzebny jest inny model (EMB-03 → EMB-06).

Surowe wyniki (tylko identyfikatory par i liczby, bez kodu): `.tmp/emb/run-*.json`.

## Przebiegi

| Data | Dostawca / model | Zbiór | Par | AP | Precyzja @próg | Wykrywalność @próg | `pattern` pod progiem | Najlepszy próg (F1) | Brak wyniku | Śr. same / pattern / different | Czas | Rozmiar modelu | Uwagi |
|---|---|---|--:|--:|--:|--:|--:|---|--:|---|--:|--:|---|
| 2026-10-21 | obecny: jscpd --semantic · jina-embeddings-v2-base-code | test | 113 | 0.528 | 0.600 | 0.070 | 0.950 | 0.545 (F1 0.62) | 29 | 0.44 / 0.45 / 0.20 | 138 s | 309 MB | wynik bazowy EMB-01 |
| 2026-10-21 | obecny: jscpd --semantic · jina-embeddings-v2-base-code | całość | 165 | 0.536 | 0.600 | 0.092 | 0.946 | 0.545 (F1 0.64) | 42 | 0.47 / 0.47 / 0.21 | 138 s | 309 MB | wynik bazowy EMB-01 |
| 2026-10-21 | http · W2 nomic-ai/CodeRankEmbed | test | 113 | 0.548 | 0.500 | 0.047 | 0.950 | 0.301 (F1 0.67) | 0 | 0.54 / 0.47 / 0.24 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W2 nomic-ai/CodeRankEmbed | całość | 165 | 0.533 | 0.600 | 0.046 | 0.964 | 0.365 (F1 0.67) | 0 | 0.55 / 0.49 / 0.26 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W3 Salesforce/codet5p-110m-embedding | test | 113 | 0.560 | 0.500 | 0.140 | 0.900 | 0.552 (F1 0.64) | 0 | 0.75 / 0.70 / 0.56 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W3 Salesforce/codet5p-110m-embedding | całość | 165 | 0.549 | 0.500 | 0.169 | 0.893 | 0.625 (F1 0.65) | 0 | 0.75 / 0.71 / 0.57 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W4 microsoft/unixcoder-base | test | 113 | 0.672 | 0.571 | 0.093 | 0.975 | 0.427 (F1 0.72) | 0 | 0.63 / 0.47 / 0.32 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W4 microsoft/unixcoder-base | całość | 165 | 0.632 | 0.500 | 0.092 | 0.964 | 0.427 (F1 0.71) | 0 | 0.64 / 0.48 / 0.33 | 2 s | — | EMB-03 zero-shot, cuda |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-trial-20261021-1136 | test | 113 | 0.768 | 0.778 | 0.163 | 0.975 | 0.484 (F1 0.74) | 0 | 0.61 / 0.30 / 0.18 | 1 s | — | EMB-06 próba: 1 epoka, 10% danych publicznych |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-trial-20261021-1136 | całość | 165 | 0.796 | 0.800 | 0.123 | 0.982 | 0.484 (F1 0.76) | 0 | 0.60 / 0.28 / 0.18 | 1 s | — | EMB-06 próba: 1 epoka, 10% danych publicznych |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-1139 | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.384 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 2 s | — | EMB-06 model publiczny: 1 epoka, wszystkie dane publiczne |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-1139 | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.467 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 2 s | — | EMB-06 model publiczny: 1 epoka, wszystkie dane publiczne |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + private-20261021-1155 | test | 113 | 0.864 | 1.000 | 0.070 | 1.000 | 0.427 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 6 s | — | EMB-06 model prywatny: 1 epoka, wszystkie dane (tylko lokalnie) |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + private-20261021-1155 | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 6 s | — | EMB-06 model prywatny: 1 epoka, wszystkie dane (tylko lokalnie) |

## Trening (EMB-06, 21.10.2026)

**W skrócie.** Douczanie działa: model prywatny podnosi AP na odłożonej części wzorca z 0,672 (model bazowy) do **0,864**, publiczny do **0,770**. Oba prawie przestały mylić „wygląda podobnie” z „robi to samo”: średnie podobieństwo par `pattern` spadło z 0,47 do 0,26–0,29. **Cele jakości z EMB-00 nie są jeszcze spełnione** — ani przez model publiczny, ani prywatny (szczegóły i powód niżej).

**Przepis** (`dustmap-emb/train.py`, `configs/*.yaml`): baza W4 `microsoft/unixcoder-base`, średnia z tokenów. Strata kontrastowa: każda kotwica ma być najbliżej swojego pozytywu spośród wszystkich pozytywów i trudnych negatywów w batchu (32 trójki, 1–3 trudne negatywy każda). Wagi rodzajów par z `data/dataset.json`. Maska wyklucza fałszywe negatywy: inne przepisania tej samej funkcji i teksty identyczne z kotwicą. Połowa kotwic to oryginalny, niesformatowany kod, bo miernik i produkt wysyłają kod surowy, a dane są w postaci kanonicznej. Inne ustawienia: bf16, gradient checkpointing, lr 2e-5, 1 epoka, stałe ziarno, wejście przycinane do 384 tokenów. Każdy zapis ma `run.json` (konfiguracja, pliki danych z sumami SHA-256, suma modelu bazowego, commit kodu) i `data-manifest.json`.

### Wyniki na zbiorze wzorcowym

AP osobno dla par publicznych i prywatnych: `python dustmap-emb/report.py "<model>"`. Próg wybrany na części **walidacyjnej** wzorca (najwyższa wykrywalność przy precyzji ≥ 0,90), potem zastosowany do części **test**.

| Model | Dane | AP test (113) | AP test: publiczne (97) / prywatne (16) | Próg (walidacja) | Precyzja | Wykrywalność | `pattern` pod progiem | Czas treningu |
|-------|------|--------------:|------------------------------------------|-----------------:|---------:|-------------:|----------------------:|--------------:|
| W4 bez douczania | — | 0,672 | 0,676 / 0,778 | 0,894 | 0,60 | 0,07 | 0,98 | — |
| próba (`public-trial`) | 10% publicznych | 0,768 | 0,797 / 0,694 | 0,569 | 0,82 | 0,63 | 0,95 | 2 min |
| **publiczny** (`public-20261021-1139`) | publiczne + syntetyczne, 55 tys. trójek | **0,770** | 0,800 / 0,630 | 0,607 | 0,88 | 0,49 | 0,98 | 16 min |
| **prywatny** (`private-20261021-1155`) | wszystkie, 207 tys. trójek | **0,864** | 0,905 / 0,757 | 0,393 | 0,81 | 0,79 | 0,85 | 72 min pracy karty (121 min zegarowo — ~45 min równolegle z grą zajmującą kartę) |
| **cel EMB-00** | | | | | **≥ 0,90** | **≥ 0,70** | **≥ 0,80** | |

Szczyt pamięci karty: 3,2 GB (publiczny), 3,9 GB (prywatny). Część prywatna wzorca ma tylko 16 par w teście — jej AP waha się mocno od jednej pary. Próg wybrany na 52 parach walidacji też jest niepewny; ostateczną kalibrację robi EMB-07.

### Krzywa uczenia (wewnętrzna walidacja: 2000 trójek z odłożonych pakietów / plików)

| Przebieg | krok 0 | wczesny | środek | koniec |
|----------|--------|---------|--------|--------|
| publiczny: strata / trafność / margines | 1,133 / 0,71 / 0,24 | 500: 0,021 / 0,990 / 0,68 | 1000: 0,019 / 0,992 / 0,70 | 1720: 0,018 / 0,992 / 0,71 |
| prywatny | 0,465 / 0,86 / 0,29 | 1250: 0,013 / 0,995 / 0,69 | 3750: 0,012 / 0,995 / 0,69 | 6479: 0,011 / 0,996 / 0,73 |

Trafność = pozytyw wygrywa ze wszystkimi kandydatami w batchu; margines = podobieństwo pozytywu minus najlepszy własny trudny negatyw. Wewnętrzna walidacja nasyca się po ~500 krokach. Dla modelu publicznego dziesięć razy więcej danych dało na wzorcu tyle samo, co próba (0,770 vs 0,768).

### Czego brakuje i dlaczego

- **Pary „to samo zadanie, inny algorytm”.** Na części walidacyjnej wzorca najsłabiej wypadają pary napisane od zera innym sposobem. Np. rok przestępny: model publiczny daje 0,06, model bazowy dawał 0,61. Podobnie dwa podejścia do `chunk` i `parse-query`. Wszystkie pozytywy z EMB-04 to przepisania **tej samej** funkcji (zmiana zapisu, historia zmian nazw, kopie). Danych typu „dwie niezależne implementacje tego samego” nie ma w ogóle — stąd szybkie nasycenie.
- **Model publiczny ma za mało prawdziwego kodu.** 6,5 tys. funkcji z 132 pakietów npm wobec 32 tys. funkcji prywatnych. Model prywatny jest lepszy także na parach **publicznych** (0,905 vs 0,800), czyli liczy się różnorodność prawdziwego kodu, a nie prywatność.
- **Precyzja przy progu.** Oba modele ściskają podobieństwa w dół (średnie `same` 0,55–0,57). Przy progu produktu 0,82 precyzja wynosi 0,88–1,00, ale wykrywalność tylko 5–16%. Próg jest do przeliczenia dla nowego modelu (EMB-07), nie do strojenia tutaj.

Co by to zmieniło (nowe zadania, nie ten brief): (1) pozytywy z niezależnych implementacji tego samego zachowania — np. funkcje z korpusu o identycznych wynikach na tych samych wejściach (już mamy piaskownicę z EMB-04); (2) więcej kodu o wolnej licencji dla modelu publicznego — wymaga zgody na pobranie.

### Prywatność

- **Model publiczny:** `python dustmap-emb/memorization_check.py <checkpoint>` potwierdza, że `run.json` wskazuje tylko `dataset/public`, sumy SHA-256 plików są te same co przy treningu, a w 63 545 wierszach (253 831 tekstów) nie ma żadnego wiersza prywatnego ani tekstu istniejącego tylko w kodzie prywatnym. Wynik zapisany jako `privacy-manifest.json` w checkpoincie.
- **Test negatywny:** ta sama kontrola na modelu prywatnym kończy się błędem („wariant private”, pliki spoza `dataset/public`).
- **Model prywatny** leży tylko w `E:\dustmap-emb-data\runs` — poza gitem.

Dysk: przebiegi 4,3 GB (po 2 rotowane checkpointy + finał), dane 1,5 GB, wagi 1,4 GB, środowisko 4,7 GB — w budżecie 25 GB.
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.384 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 119 s | — | EMB-07 ONNX fp32, CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.467 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 119 s | — | EMB-07 ONNX fp32, CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | test | 113 | 0.718 | 0.422 | 1.000 | 0.050 | 0.912 (F1 0.77) | 0 | 0.94 / 0.89 / 0.87 | 97 s | — | EMB-07 ONNX int8, CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | całość | 165 | 0.741 | 0.433 | 1.000 | 0.036 | 0.917 (F1 0.76) | 0 | 0.94 / 0.89 / 0.87 | 97 s | — | EMB-07 ONNX int8, CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | test | 113 | 0.864 | 1.000 | 0.070 | 1.000 | 0.427 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 118 s | — | EMB-07 ONNX fp32, CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 118 s | — | EMB-07 ONNX fp32, CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | test | 113 | 0.654 | 0.406 | 0.953 | 0.025 | 0.891 (F1 0.67) | 0 | 0.94 / 0.91 / 0.85 | 59 s | — | EMB-07 ONNX int8, CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | całość | 165 | 0.667 | 0.412 | 0.938 | 0.018 | 0.920 (F1 0.67) | 0 | 0.93 / 0.91 / 0.86 | 59 s | — | EMB-07 ONNX int8, CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.384 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 101 s | — | EMB-07 ONNX fp32, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.467 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 101 s | — | EMB-07 ONNX fp32, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | test | 113 | 0.766 | 0.422 | 1.000 | 0.075 | 0.910 (F1 0.79) | 0 | 0.94 / 0.88 / 0.86 | 78 s | — | EMB-07 ONNX int8, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | całość | 165 | 0.772 | 0.436 | 1.000 | 0.089 | 0.908 (F1 0.78) | 0 | 0.94 / 0.88 / 0.86 | 78 s | — | EMB-07 ONNX int8, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | test | 113 | 0.864 | 1.000 | 0.070 | 1.000 | 0.427 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 98 s | — | EMB-07 ONNX fp32, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 98 s | — | EMB-07 ONNX fp32, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | test | 113 | 0.654 | 0.406 | 0.953 | 0.025 | 0.891 (F1 0.67) | 0 | 0.94 / 0.91 / 0.85 | 64 s | — | EMB-07 ONNX int8, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | całość | 165 | 0.667 | 0.412 | 0.938 | 0.018 | 0.920 (F1 0.67) | 0 | 0.93 / 0.91 / 0.86 | 64 s | — | EMB-07 ONNX int8, CPU 16 wątków, po 1 funkcji |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.384 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 53 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.467 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 53 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | test | 113 | 0.768 | 0.875 | 0.163 | 1.000 | 0.387 (F1 0.74) | 0 | 0.57 / 0.30 / 0.16 | 60 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.379 (F1 0.76) | 0 | 0.57 / 0.29 / 0.17 | 60 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | test | 113 | 0.864 | 1.000 | 0.070 | 1.000 | 0.427 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 46 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-private | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 46 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | test | 113 | 0.858 | 1.000 | 0.093 | 1.000 | 0.426 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 58 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-private | całość | 165 | 0.858 | 1.000 | 0.062 | 1.000 | 0.390 (F1 0.82) | 0 | 0.53 / 0.25 / 0.12 | 58 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |

## Eksport ONNX i odchudzenie (EMB-07, 21.10.2026)

**W skrócie.** Oba modele działają teraz bez Pythona i bez karty graficznej: jeden plik ONNX (127 MB) + `tokenizer.json`, z uśrednianiem i normalizacją wektora w środku grafu. Jakość prawie bez strat. **Cel szybkości (≥ 50 funkcji/s na CPU) jest nieosiągalny dla tego modelu** — jest 7–10 funkcji/s. Szczegóły i co z tym zrobić niżej.

| Paczka (`dustmap-emb/dist/`) | AP test, pełna precyzja (ONNX) | AP test, int8 | Spadek | Rozmiar | Funkcje/s, CPU 16 wątków | `private` |
|---|--:|--:|--:|--:|--:|---|
| `dustmap-same-meaning-public` | 0,770 | **0,768** | 0,15 pkt | 127 MB (z 502) | 9,8 | `false`, Apache-2.0 |
| `dustmap-same-meaning-private` | 0,864 | **0,858** | 0,60 pkt | 127 MB (z 502) | 6,7 | `true`, bez licencji |
| **cel z briefu** | | | **≤ 1 pkt** | **≤ 150 MB** | **≥ 50** | |

- **Eksport** (`export_onnx.py`): wejścia `input_ids`, `attention_mask`, wyjście `embedding` [n, 768] o długości 1. Wektory ONNX vs PyTorch na 1000 funkcjach z korpusu: najmniejsze podobieństwo cosinusowe 1,000000 (próg 0,999), dla obu modeli. Wzorzec PyTorch liczony na karcie, graf ONNX na procesorze.
- **Int8 tylko na wagach** (`quantize.py`, `weight_only.py`): każda macierz wag i tablica tokenów zapisane 8-bitowo, ze skalą na kolumnę / wiersz; obliczenia dalej w pełnej precyzji. Wektor funkcji liczonej samodzielnie i w paczce z innymi jest identyczny (cosinus 0,999999). Plik jest 4× mniejszy. Szybkość jak pełnej precyzji, jeśli sesja ma ustawione `session.disable_quant_qdq=1` — wtedy wagi są rozpakowywane raz przy wczytaniu (bez tego int8 było o ~25% wolniejsze).
- **Odrzucone: int8 „dynamiczne”** (standard ONNX Runtime). Przelicza skalę wartości pośrednich z całego wejścia, razem z dopełnieniem:
  - w paczkach po 16 wektor funkcji zależał od jej sąsiadów (cosinus 0,95–0,99 do samej siebie), a AP modelu publicznego spadło do 0,719;
  - nawet przy osadzaniu po jednej funkcji model prywatny tracił 21 pkt (0,864 → 0,654);
  - skala podobieństw przesuwała się w górę (średnio `same` 0,94, `pattern` 0,88).
  
  Wiersze `onnx int8 …` w tabeli przebiegów z notą „CPU 16 wątków” albo „po 1 funkcji” to te odrzucone próby. Obowiązują wiersze z notą „int8 = tylko wagi”.
- **Paczka** (`package.py`) zawiera `model.onnx`, `tokenizer.json` i `manifest.json`: sumy SHA-256 i rozmiary plików, wersja 0.1.0, maks. 512 tokenów, kształt wyjścia, licencja, `private`, sposób użycia, pochodzenie treningu (przebieg, sumy plików danych, commit), jakość i szybkość. Paczka publiczna ma tylko z pozytywną kontrolą prywatności z EMB-06. `python dustmap-emb/verify_package.py` sprawdza wszystko jednym poleceniem: pola, licencja ↔ `private`, sumy plików, brak obcych plików, wczytanie modelu i wektory długości 1. Test negatywny: zmieniony bajt w `tokenizer.json` i paczka publiczna bez licencji — oba wychwycone. `dist/` jest poza gitem.

### Dlaczego nie 50 funkcji/s

Model ma 126 M parametrów, a funkcje z korpusu mają medianę ~100 tokenów (10% ma ponad 370). To kilkadziesiąt miliardów operacji na funkcję. Ten procesor robi tego realnie kilkaset miliardów na sekundę, czyli wychodzi ~10 funkcji/s. Kwantyzacja tylko wag nie przyspiesza, a dynamiczna (która przyspiesza) psuje wyniki. Pomiary szybkości robione przy obciążeniu komputera innymi programami 34–39% (przy pracującej grze wychodziło 4–5 funkcji/s). Na czystej maszynie będzie trochę lepiej, ale nie pięć razy.

Co mogłoby dać ≥ 50 funkcji/s (decyzja produktowa, nie ten brief):
1. **Karta graficzna, gdy jest.** Ten sam model w PyTorch na RTX 4070 Ti robił 255–315 funkcji/s (EMB-03). W Dustmapie oznacza to ONNX Runtime z obsługą karty i paczkę fp16 obok int8 — do EMB-08.
2. **Mniejszy model** — destylacja do ~6 warstw / ~40 M parametrów, uczony na wektorach obecnego modelu. Wymaga treningu i nowego pomiaru jakości.

Zgoda maintainera z 21.10.2026 na pobrania potrzebne do zadania: „masz pozwolenie na zaciąganie paczki i czegokolwiek tylko potrzebujesz”. W EMB-07 nic nie pobrano — rozwiązanie korzysta z już zainstalowanych `onnx`, `onnxruntime` i `numpy`.
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.384 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 64 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | całość | 165 | 0.788 | 0.889 | 0.123 | 1.000 | 0.467 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 64 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-private | test | 113 | 0.864 | 1.000 | 0.070 | 1.000 | 0.426 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 63 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-private | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 63 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | onnx · dustmap-same-meaning-private | test | 113 | 0.860 | 1.000 | 0.093 | 1.000 | 0.426 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 28 s | 121 MB | EMB-08 dostawca onnx w Dustmapie, device=cpu; wariant cpu |
| 2026-10-21 | onnx · dustmap-same-meaning-private | całość | 165 | 0.859 | 1.000 | 0.062 | 1.000 | 0.389 (F1 0.82) | 0 | 0.53 / 0.25 / 0.12 | 28 s | 121 MB | EMB-08 dostawca onnx w Dustmapie, device=cpu; wariant cpu |
| 2026-10-21 | onnx · dustmap-same-meaning-private | test | 113 | 0.863 | 1.000 | 0.070 | 1.000 | 0.427 (F1 0.81) | 0 | 0.55 / 0.26 / 0.12 | 3 s | 239 MB | EMB-08 dostawca onnx w Dustmapie, device=auto; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-private | całość | 165 | 0.862 | 1.000 | 0.046 | 1.000 | 0.391 (F1 0.81) | 0 | 0.52 / 0.25 / 0.12 | 3 s | 239 MB | EMB-08 dostawca onnx w Dustmapie, device=auto; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 113 | 0.768 | 0.875 | 0.163 | 1.000 | 0.388 (F1 0.74) | 0 | 0.57 / 0.30 / 0.16 | 24 s | 121 MB | EMB-08 dostawca onnx w Dustmapie, device=cpu; wariant cpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.474 (F1 0.75) | 0 | 0.57 / 0.29 / 0.17 | 24 s | 121 MB | EMB-08 dostawca onnx w Dustmapie, device=cpu; wariant cpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 113 | 0.770 | 0.875 | 0.163 | 1.000 | 0.385 (F1 0.74) | 0 | 0.57 / 0.29 / 0.16 | 3 s | 239 MB | EMB-08 dostawca onnx w Dustmapie, device=auto; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 165 | 0.787 | 0.889 | 0.123 | 1.000 | 0.385 (F1 0.75) | 0 | 0.56 / 0.29 / 0.17 | 3 s | 239 MB | EMB-08 dostawca onnx w Dustmapie, device=auto; wariant gpu |

## Dostawca `onnx` w Dustmapie, z kartą graficzną (EMB-08, 21.10.2026)

**W skrócie.** Dustmap sam liczy wektory funkcji modelem z paczki. Działa bez sieci i bez Pythona. Gdy jest karta graficzna, używa jej (wariant fp16 przez DirectML na Windows, CUDA na Linuksie). Bez karty liczy na procesorze (wariant int8). Znajduje **wszystkie** pary nad progiem, a nie tylko część jak jscpd, i składa je w grupy według decyzji z DUST-15.

```json
{ "semantic": { "provider": "onnx", "model": "dustmap-same-meaning-public", "device": "auto" } }
```

Paczka leży w `~/.cache/dustmap/models/<id>/` (albo `semantic.modelDir`, albo `$DUSTMAP_MODELS_DIR`). Przed użyciem Dustmap sprawdza sumy SHA-256 wszystkich plików z `manifest.json`. Brak albo zmiana pliku daje czytelny błąd — modelu nigdy nie pobiera sam (pobieranie to EMB-11).

| Miernik przez dostawcę Dustmapa (`npm run emb:eval -- --provider onnx`) | AP test | Czas (165 par, z wczytaniem) |
|---|--:|--:|
| prywatny, karta (fp16, DirectML) | 0,863 | 3 s |
| prywatny, procesor (int8) | 0,860 | 28 s |
| publiczny, karta | 0,770 | 3 s |
| publiczny, procesor | 0,768 | 24 s |

**Prawdziwy kod — migawka Monorepo-A** (model prywatny, karta, próg 0,82). Skan dotyczy tylko części „po sensie”; migawka tylko do odczytu, wyniki w `.tmp/emb08/`.
- 22 342 funkcje, porównane wszystkie pary.
- Pierwszy skan 160 s (~140 funkcji/s razem z wycinaniem i wszystkimi parami), drugi 18 s — niczego nie liczy od nowa.
- 4521 par nad progiem → 868 znalezisk: 773 grupy kopii jednej funkcji i 95 par „dwa równoległe pliki”.
- To dużo — próg 0,82 dobrano pod starą skalę modelu jina; ustawienie go dla nowego modelu to EMB-09.

**Co zmieniono:**
- **Wycinanie funkcji przez parser TypeScript** zamiast dopasowywania nawiasów (`extract.ts`). Łapie:
  - funkcje, także zagnieżdżone;
  - metody klas i obiektów, akcesory i konstruktory (z nazwą `Klasa.metoda`);
  - strzałki przypisane do nazw.

  Linie są dokładne, a komentarze usuwa skaner — zmiana komentarza nie zmienia odcisku.
- **Wszystkie pary dokładnie** (`similarity.ts`): do 1500 funkcji w JS, powyżej jako mnożenie macierzy w ONNX Runtime (jednowęzłowy graf zapisany w kodzie). Na 2000 wektorów wynik jest identyczny jak w zwykłej pętli. 22 tys. funkcji to kilka sekund. Indeks przybliżony nie był potrzebny.
- **Grupy** (`cluster.ts`):
  - jedna funkcja w N kopiach → jedno znalezisko z N miejscami;
  - kilka osobnych par między tymi samymi dwoma plikami → jedno znalezisko „dwa równoległe systemy”.

  Dowody: kształt grupy, liczba funkcji i par, min/max podobieństwa, nazwy, liczba plików.
- **Pamięć wektorów binarna** (`vector-cache.ts`): float32 + indeks, wartości bez zmian. Na Monorepo-A 66 MB zamiast 309 MB w JSON, drugi skan 18 s zamiast 29 s.
- **Zależności:** `onnxruntime-node` 1.30.0 (MIT) i `@huggingface/tokenizers` 0.2.0 (Apache-2.0). Bramka licencji przechodzi. Tokenizer JS daje identyczne tokeny jak Python na 4004 funkcjach, także przy przycinaniu długich i nietypowych znakach. ONNX Runtime waży ~300 MB (binarki dla wszystkich systemów). Na Linuksie jego instalator przy `npm install` może dociągnąć z NuGet pliki CUDA — to instalacja, nie skan.
- **Paczki modeli mają dwa warianty** (`dustmap-emb/half.py`, `package.py`): `cpu` = `model.onnx` (int8, 127 MB) i `gpu` = `model.fp16.onnx` (251 MB). AP wariantu fp16 = pełna precyzja (0,770 / 0,864). Wektory z karty i z procesora różnią się minimalnie (cosinus ≥ 0,993), więc pamięć wektorów trzyma je osobno (id modelu zawiera wariant).

**Sprawdzone:**
- `npm run verify` — w tym nowe testy: wycinanie (metody, strzałki w obiektach, funkcje zagnieżdżone), paczka modelu (sumy, brak modelu, zmieniony plik), dostawca (wektory długości 1, ten sam wynik osobno i w paczce, przycinanie), dokładność wszystkich par i grupowanie „dwa równoległe pliki”. Wszystko na modelu testowym 38 KB w `packages/core/fixtures/onnx-model`, bez sieci.
- `npm run verify:targets` — bez zmian (domyślny skan nadal używa jscpd).
- Lab `03` — zielony: trzy te same pętle = jedna grupa z 3 miejscami. Jedno oczekiwanie poprawione: `totalOf` i `totalPositive` lab uznawał za „tę samą pętlę”, ale `totalOf` odejmuje 1 przy liczbie ≤ 0 i dodaje długość tablicy. Stary model je łączył (0,88), nowy słusznie rozdziela (0,43). Pięć par zostaje oznaczonych jako znane — nowy model daje im 0,43–0,68, poniżej progu 0,82 dobranego pod jina (EMB-09).

Pobrania w tym zadaniu (zgoda maintainera z 21.10.2026 — „masz pozwolenie na zaciąganie paczki i czegokolwiek tylko potrzebujesz”): `onnxruntime-node` 1.30.0 i `@huggingface/tokenizers` 0.2.0 z npm; `onnxconverter-common` 1.16.0 (MIT) do środowiska Pythona na E: (konwersja fp16).

## Kalibracja: od podobieństwa do pewności (EMB-09, 21.10.2026)

**W skrócie.** Każda paczka modelu niesie teraz własne progi pewności, bo każdy model ma inną skalę podobieństw. Raport mówi `high` tam, gdzie ≥ 90% par zbioru wzorcowego to prawdziwe duplikaty, a `medium` tam, gdzie ≥ 75%. Poniżej `medium` raport milczy. Wzorce celowe są rozpoznawane z drzewa składni i dostają pewność o stopień niżej oraz dowód „wspólny wzorzec”. **Model publiczny spełnia cele na odłożonej części, model prywatny jeszcze nie.**

| Część test (113 par), `npm run emb:eval -- --provider onnx --model <id> --calibrated` | publiczny (karta) | prywatny (karta) | cel |
|---|--:|--:|--:|
| progi z walidacji: `high` / `medium` | 0,608 / 0,466 | 0,393 / 0,339 | — |
| trafność `high` | **0,913** (23 pary) | 0,829 (41) | ≥ 0,90 |
| trafność `medium` i wyżej | **0,750** (40) | 0,739 (46) | ≥ 0,75 |
| wykrywalność par „ten sam sens” od `medium` | 0,698 | 0,791 | — |
| wzorce poniżej `medium` | **0,875** | 0,800 | ≥ 0,80 |

Wariant procesorowy ma własne progi (publiczny 0,603 / 0,479), bo jego wektory minimalnie się różnią.

**Jak liczone.** `npm run emb:calibrate -- --model <id>` (`tools/emb/calibrate.mts`):
- każdą parę części **walidacyjnej** (52 pary) przepuszcza przez dostawcę Dustmapa, osobno dla każdego wariantu;
- wyznacza najniższe podobieństwo, od którego trafność skumulowana osiąga 0,90 (`high`) i 0,75 (`medium`);
- zapisuje to w `manifest.json` paczki.

Część testowa służy tylko do sprawdzenia. Progów nie poprawiałem pod nią, także dla modelu prywatnego.

**Dlaczego raport zaczyna się od `medium`, a nie od progu 50%.** W zbiorze wzorcowym ok. 40% par to duplikaty, więc 50% trafności wypada przy niemal przypadkowym podobieństwie (0,05–0,22). W prawdziwym repo duplikaty to ułamek promila wszystkich par: na Monorepo-A (21 518 funkcji, 231 mln par) model prywatny daje 42 329 par powyżej 0,45 i 813 powyżej 0,9. Próg 0,2 zalałby raport. Poziom `low` dostaje tylko wzorzec rozpoznany na poziomie `medium`. Próbowałem też liczyć tło z par funkcji z różnych pakietów npm, ale paczki dzielą ten sam kod pomocniczy, więc ogon to prawdziwe kopie — taki pomiar nic nie mówi o fałszywych alarmach. Czy progi trzymają się na prawdziwym kodzie, sprawdza ręczny przegląd w EMB-10.

**Wzorce** (`packages/core/src/semantic/calibration.ts`, tylko struktura, bez nazw). Dwie funkcje, które nie są prawie-kopiami, mają wspólny wzorzec, gdy:
- obie są jednym wywołaniem na tym samym obiekcie lub tej samej funkcji z innymi argumentami (rejestracje tras i zdarzeń, deklaracje);
- obie zwracają wywołanie tej samej funkcji z innym obiektem konfiguracji;
- mają te same instrukcje otwierające, a dalej inną logikę;
- obie są jednym `switch` po tym samym polu;
- obie owijają różną pracę tym samym blokiem `catch`.

Reguły projektowałem wyłącznie na części walidacyjnej. Rozpoznają 8 z 13 jej wzorców i nie oznaczają żadnej pary „ten sam sens”. Odrzucona reguła „ten sam podpis portu”: łapała 3 prawdziwe duplikaty, bo dwie niezależne implementacje tej samej funkcji naturalnie mają ten sam podpis. Wzorców, które różnią się tylko literałami i jednym wywołaniem (migracje, walidatory, opakowania `fetch`), reguła nie rusza — tak samo wyglądają kopie z innymi literałami, które dane uznają za „ten sam sens”. Zastąpiona reguła `looksLikeConfigFactory` opierała się na liście nazw (`name|id|handler|run`) i znikła.

**W produkcie:** `semantic.threshold` jest teraz opcjonalny. Bez niego paczka `onnx` raportuje od swojego progu `medium`, a `local` i `http` od 0,82 jak dotąd. Pewność grupy liczy się z jej najsilniejszej pary według pasm modelu. Grupa, w której każda para ma wspólny wzorzec, dostaje stopień niżej.

**Model prywatny nie spełnia celów** (0,829 / 0,739 / 0,80), bo jego progi wyznaczyło 52 pary walidacji, w tym tylko 7 prywatnych. Lepsza kalibracja wymaga większej części walidacyjnej z prawdziwego kodu — to robota dla przeglądu w EMB-10, nie dla strojenia pod część testową. Domyślnym modelem produktu ma być i tak model publiczny.
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-1855 | test | 113 | 0.800 | 0.800 | 0.186 | 0.975 | 0.400 (F1 0.79) | 0 | 0.62 / 0.26 / 0.17 | 2 s | — | EMB-12 model publiczny z parami „inny algorytm” |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-1855 | całość | 165 | 0.814 | 0.818 | 0.138 | 0.982 | 0.482 (F1 0.79) | 0 | 0.60 / 0.26 / 0.16 | 2 s | — | EMB-12 model publiczny z parami „inny algorytm” |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | test | 113 | 0.800 | 0.800 | 0.186 | 0.975 | 0.400 (F1 0.79) | 0 | 0.62 / 0.26 / 0.17 | 72 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | całość | 165 | 0.814 | 0.818 | 0.138 | 0.982 | 0.482 (F1 0.79) | 0 | 0.60 / 0.26 / 0.16 | 72 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | test | 113 | 0.798 | 0.889 | 0.186 | 0.975 | 0.405 (F1 0.79) | 0 | 0.62 / 0.27 / 0.17 | 68 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | całość | 165 | 0.814 | 0.900 | 0.138 | 0.982 | 0.485 (F1 0.79) | 0 | 0.60 / 0.26 / 0.17 | 68 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | test | 113 | 0.800 | 0.800 | 0.186 | 0.975 | 0.399 (F1 0.79) | 0 | 0.62 / 0.26 / 0.17 | 91 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | całość | 165 | 0.814 | 0.818 | 0.138 | 0.982 | 0.483 (F1 0.79) | 0 | 0.60 / 0.26 / 0.16 | 91 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 113 | 0.800 | 0.800 | 0.186 | 0.975 | 0.399 (F1 0.79) | 0 | 0.62 / 0.26 / 0.17 | 4 s | 239 MB | EMB-12 model publiczny v0.2.0, device=gpu; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 165 | 0.815 | 0.818 | 0.138 | 0.982 | 0.482 (F1 0.79) | 0 | 0.60 / 0.26 / 0.16 | 4 s | 239 MB | EMB-12 model publiczny v0.2.0, device=gpu; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 113 | 0.798 | 0.889 | 0.186 | 0.975 | 0.405 (F1 0.79) | 0 | 0.62 / 0.27 / 0.17 | 31 s | 121 MB | EMB-12 model publiczny v0.2.0, device=cpu; wariant cpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 165 | 0.814 | 0.900 | 0.138 | 0.982 | 0.485 (F1 0.79) | 0 | 0.60 / 0.26 / 0.17 | 31 s | 121 MB | EMB-12 model publiczny v0.2.0, device=cpu; wariant cpu |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-2030 | test | 113 | 0.787 | 0.875 | 0.163 | 0.975 | 0.458 (F1 0.77) | 0 | 0.60 / 0.27 / 0.16 | 1 s | — | EMB-12 model publiczny: „inny algorytm” + mutanty |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + public-20261021-2030 | całość | 165 | 0.802 | 0.909 | 0.154 | 0.982 | 0.407 (F1 0.78) | 0 | 0.59 / 0.27 / 0.15 | 1 s | — | EMB-12 model publiczny: „inny algorytm” + mutanty |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | test | 113 | 0.787 | 0.875 | 0.163 | 0.975 | 0.458 (F1 0.77) | 0 | 0.60 / 0.27 / 0.16 | 63 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp32 dustmap-same-meaning-public | całość | 165 | 0.802 | 0.909 | 0.154 | 0.982 | 0.407 (F1 0.78) | 0 | 0.59 / 0.27 / 0.15 | 63 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | test | 113 | 0.785 | 0.875 | 0.163 | 0.975 | 0.452 (F1 0.77) | 0 | 0.60 / 0.28 / 0.16 | 64 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx int8 dustmap-same-meaning-public | całość | 165 | 0.800 | 0.909 | 0.154 | 0.982 | 0.439 (F1 0.78) | 0 | 0.59 / 0.27 / 0.16 | 64 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | test | 113 | 0.787 | 0.875 | 0.163 | 0.975 | 0.458 (F1 0.77) | 0 | 0.60 / 0.27 / 0.16 | 66 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | http · onnx fp16 dustmap-same-meaning-public | całość | 165 | 0.802 | 0.909 | 0.154 | 0.982 | 0.407 (F1 0.78) | 0 | 0.59 / 0.27 / 0.15 | 66 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 113 | 0.787 | 0.875 | 0.163 | 0.975 | 0.457 (F1 0.77) | 0 | 0.60 / 0.27 / 0.16 | 6 s | 239 MB | EMB-12 model publiczny v0.2.0 (inny algorytm + mutanty), karta; wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 165 | 0.803 | 0.909 | 0.154 | 0.982 | 0.408 (F1 0.78) | 0 | 0.59 / 0.27 / 0.15 | 6 s | 239 MB | EMB-12 model publiczny v0.2.0 (inny algorytm + mutanty), karta; wariant gpu |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + private-20261021-2052 | test | 113 | 0.833 | 1.000 | 0.163 | 1.000 | 0.329 (F1 0.78) | 0 | 0.56 / 0.25 / 0.11 | 2 s | — | EMB-12 model prywatny: „inny algorytm” + mutanty (tylko lokalnie) |
| 2026-10-21 | http · W4 microsoft/unixcoder-base + private-20261021-2052 | całość | 165 | 0.856 | 1.000 | 0.138 | 1.000 | 0.329 (F1 0.79) | 0 | 0.55 / 0.23 / 0.10 | 2 s | — | EMB-12 model prywatny: „inny algorytm” + mutanty (tylko lokalnie) |
| 2026-10-21 | onnx · dustmap-same-meaning-public | test | 232 | 0.786 | 0.816 | 0.348 | 0.891 | 0.458 (F1 0.75) | 0 | 0.70 / 0.41 / 0.28 | 10 s | 239 MB | wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | prawdziwy | 241 | 0.767 | 0.765 | 0.506 | 0.810 | 0.624 (F1 0.73) | 0 | 0.78 / 0.64 / 0.35 | 10 s | 239 MB | wariant gpu |
| 2026-10-21 | onnx · dustmap-same-meaning-public | całość | 406 | 0.734 | 0.790 | 0.345 | 0.895 | 0.458 (F1 0.70) | 0 | 0.69 / 0.46 / 0.29 | 10 s | 239 MB | wariant gpu |
| 2026-10-22 | onnx · dustmap-same-meaning-public | test | 232 | 0.786 | 0.816 | 0.348 | 0.891 | 0.458 (F1 0.75) | 0 | 0.70 / 0.41 / 0.28 | 9 s | 239 MB | wariant gpu |
| 2026-10-22 | onnx · dustmap-same-meaning-public | prawdziwy | 241 | 0.767 | 0.765 | 0.506 | 0.810 | 0.624 (F1 0.73) | 0 | 0.78 / 0.64 / 0.35 | 9 s | 239 MB | wariant gpu |
| 2026-10-22 | onnx · dustmap-same-meaning-public | całość | 406 | 0.734 | 0.790 | 0.345 | 0.895 | 0.458 (F1 0.70) | 0 | 0.69 / 0.46 / 0.29 | 9 s | 239 MB | wariant gpu |
| 2026-10-22 | http · onnx fp32 dustmap-same-meaning-private | test | 232 | 0.741 | 0.818 | 0.212 | 0.948 | 0.389 (F1 0.70) | 0 | 0.61 / 0.42 / 0.23 | 433 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-22 | http · onnx fp32 dustmap-same-meaning-private | całość | 406 | 0.715 | 0.857 | 0.205 | 0.960 | 0.385 (F1 0.69) | 0 | 0.62 / 0.45 / 0.25 | 433 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-22 | http · onnx int8 dustmap-same-meaning-private | test | 232 | 0.743 | 0.818 | 0.212 | 0.948 | 0.507 (F1 0.70) | 0 | 0.61 / 0.43 / 0.24 | 427 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-22 | http · onnx int8 dustmap-same-meaning-private | całość | 406 | 0.715 | 0.857 | 0.205 | 0.960 | 0.388 (F1 0.69) | 0 | 0.62 / 0.45 / 0.25 | 427 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków |
| 2026-10-22 | http · onnx fp16 dustmap-same-meaning-private | test | 232 | 0.741 | 0.818 | 0.212 | 0.948 | 0.390 (F1 0.70) | 0 | 0.61 / 0.42 / 0.23 | 502 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-22 | http · onnx fp16 dustmap-same-meaning-private | prawdziwy | 241 | 0.771 | 0.871 | 0.333 | 0.943 | 0.518 (F1 0.72) | 0 | 0.75 / 0.53 / 0.27 | 502 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-22 | http · onnx fp16 dustmap-same-meaning-private | całość | 406 | 0.715 | 0.857 | 0.205 | 0.960 | 0.385 (F1 0.69) | 0 | 0.62 / 0.45 / 0.25 | 502 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU |
| 2026-10-22 | onnx · dustmap-same-meaning-private | test | 232 | 0.743 | 0.818 | 0.212 | 0.948 | 0.507 (F1 0.70) | 0 | 0.61 / 0.43 / 0.24 | 145 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-22 | onnx · dustmap-same-meaning-private | prawdziwy | 241 | 0.771 | 0.871 | 0.333 | 0.943 | 0.506 (F1 0.72) | 0 | 0.75 / 0.53 / 0.28 | 145 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-22 | onnx · dustmap-same-meaning-private | całość | 406 | 0.715 | 0.857 | 0.205 | 0.960 | 0.388 (F1 0.69) | 0 | 0.62 / 0.45 / 0.25 | 145 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-22 | onnx · dustmap-same-meaning-private | test | 232 | 0.743 | 0.818 | 0.212 | 0.948 | 0.507 (F1 0.70) | 0 | 0.61 / 0.43 / 0.24 | 143 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-22 | onnx · dustmap-same-meaning-private | prawdziwy | 241 | 0.771 | 0.871 | 0.333 | 0.943 | 0.506 (F1 0.72) | 0 | 0.75 / 0.53 / 0.28 | 143 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-22 | onnx · dustmap-same-meaning-private | całość | 406 | 0.715 | 0.857 | 0.205 | 0.960 | 0.388 (F1 0.69) | 0 | 0.62 / 0.45 / 0.25 | 143 s | 132 MB | EMB-15 W2 CodeRankEmbed private ONNX int8, po kalibracji; wariant cpu |
| 2026-10-23 | onnx · dustmap-same-meaning-private | test | 1258 | 0.499 | 0.419 | 0.325 | 0.788 | 0.412 (F1 0.56) | 0 | 0.74 / 0.63 / 0.35 | 18 s | 262 MB | wariant gpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | onnx · dustmap-same-meaning-private | prawdziwy | 1374 | 0.466 | 0.353 | 0.352 | 0.755 | 0.488 (F1 0.52) | 0 | 0.78 / 0.66 / 0.39 | 18 s | 262 MB | wariant gpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | onnx · dustmap-same-meaning-private | całość | 1539 | 0.458 | 0.358 | 0.305 | 0.777 | 0.412 (F1 0.53) | 0 | 0.72 / 0.63 / 0.37 | 18 s | 262 MB | wariant gpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | onnx · dustmap-same-meaning-private | test | 1258 | 0.499 | 0.414 | 0.325 | 0.785 | 0.388 (F1 0.56) | 0 | 0.74 / 0.63 / 0.35 | 362 s | 132 MB | CON-09 baseline EMB-15 on gold v2; wariant cpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | onnx · dustmap-same-meaning-private | prawdziwy | 1374 | 0.466 | 0.353 | 0.352 | 0.757 | 0.489 (F1 0.52) | 0 | 0.78 / 0.66 / 0.39 | 362 s | 132 MB | CON-09 baseline EMB-15 on gold v2; wariant cpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | onnx · dustmap-same-meaning-private | całość | 1539 | 0.459 | 0.358 | 0.305 | 0.779 | 0.397 (F1 0.54) | 0 | 0.73 / 0.63 / 0.38 | 362 s | 132 MB | CON-09 baseline EMB-15 on gold v2; wariant cpu; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp32 dustmap-same-meaning-private-con11 | test | 1258 | 0.491 | 0.592 | 0.216 | 0.916 | 0.173 (F1 0.53) | 0 | 0.57 / 0.46 / 0.22 | 1333 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp32 dustmap-same-meaning-private-con11 | prawdziwy | 1374 | 0.468 | 0.532 | 0.233 | 0.911 | 0.224 (F1 0.49) | 0 | 0.62 / 0.48 / 0.26 | 1333 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp32 dustmap-same-meaning-private-con11 | całość | 1539 | 0.459 | 0.535 | 0.199 | 0.920 | 0.175 (F1 0.51) | 0 | 0.56 / 0.45 / 0.24 | 1333 s | — | EMB-07 ONNX fp32 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx int8 dustmap-same-meaning-private-con11 | test | 1258 | 0.493 | 0.606 | 0.216 | 0.925 | 0.201 (F1 0.53) | 0 | 0.57 / 0.45 / 0.22 | 1541 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx int8 dustmap-same-meaning-private-con11 | prawdziwy | 1374 | 0.469 | 0.550 | 0.233 | 0.921 | 0.220 (F1 0.49) | 0 | 0.62 / 0.48 / 0.26 | 1541 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx int8 dustmap-same-meaning-private-con11 | całość | 1539 | 0.460 | 0.550 | 0.199 | 0.927 | 0.201 (F1 0.51) | 0 | 0.55 / 0.45 / 0.24 | 1541 s | — | EMB-07 ONNX int8 (int8 = tylko wagi), CPU 16 wątków; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp16 dustmap-same-meaning-private-con11 | test | 1258 | 0.491 | 0.595 | 0.218 | 0.916 | 0.172 (F1 0.53) | 0 | 0.57 / 0.46 / 0.22 | 1780 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp16 dustmap-same-meaning-private-con11 | prawdziwy | 1374 | 0.467 | 0.535 | 0.236 | 0.911 | 0.223 (F1 0.49) | 0 | 0.62 / 0.48 / 0.26 | 1780 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |
| 2026-10-23 | http · onnx fp16 dustmap-same-meaning-private-con11 | całość | 1539 | 0.459 | 0.538 | 0.201 | 0.920 | 0.195 (F1 0.51) | 0 | 0.56 / 0.45 / 0.24 | 1780 s | — | EMB-08 ONNX fp16 (wariant na kartę), liczone na CPU; 102 par prywatnych pominiętych: kod pod odnośnikiem się zmienił lub nie ma migawki |

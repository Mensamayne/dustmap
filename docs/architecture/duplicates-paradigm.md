# Duplikaty i ujednolicenia — paradygmat (25.10.2026)

Dokument decyzyjny po epikach EMB i CON. Cel projektu w słowach maintainera: Dustmap dostaje kawałki kodu i mówi *„to są jednakowe rzeczy, robią to samo, ten po lewej to kopia tego po prawej”* albo *„ten CSS to dosłownie tamten, tylko inaczej nazwany”*. Na tej podstawie proponuje ujednolicenia i refaktory. Clean code, kompleksowo.

## 1. Co pokazały pomiary (fakty, nie hipotezy)

| Pomiar | Wynik | Co znaczy |
|---|---|---|
| Model wektorowy (EMB-15), zestaw testowy, AP | 0,705 | ranking „duplikat vs nie” |
| Ten sam model bez naszego treningu | 0,685 | trening dał +0,02 |
| Trzy kolejne treningi (CON-11, CON-14 ×3) | 0,64–0,69 | każdy spadał od pierwszych kroków |
| Sędzia par (lokalny Qwen 7B, bez treningu) | **0,798** | widzi oba kawałki naraz |
| Odnalezienie partnera: top-10 / top-20 / top-50 spośród 41 tys. jednostek Monorepo-A | **85% / 92% / 98%** | model wektorowy dobrze *znajduje* |
| Samo zliczanie wspólnych słów | 0,625 | dolna granica |

**Wniosek.** Model wektorowy koduje każdy kawałek osobno. Dobrze znajduje kandydatów: 92% prawdziwych duplikatów jest w top-20. Nie umie natomiast rozstrzygnąć różnicy „ta sama robota z inną stałą” kontra „ten sam szkielet na innym polu”, bo to wymaga porównania obu kawałków naraz. Dlatego każdy trening stoi na ~0,7. To granica typu modelu, nie danych. Sędzia par, który widzi oba kawałki, od razu ma 0,80.

Literatura mówi to samo. Wykrywanie klonów dzieli się na typy (1: kopia, 2: kopia z innymi nazwami, 3: kopia ze zmianami, 4: ta sama robota inaczej). Typy 1–3 rozwiązują deterministyczne metody (normalizacja drzewa składni, porównanie po normalizacji). Typ 4 to dziś dwa etapy: wyszukanie kandydatów, potem ocena pary przez model widzący oba kawałki, a w najlepszych pracach dodatkowo test zachowania przez uruchomienie (HyClone, 2025). Ujednolicenia z klonów robi się przez wspólne uogólnienie dwóch drzew składni (anti-unification): wspólny szkielet i „dziury”, które stają się parametrami. To podstawa narzędzi typu „extract method z parametrami” (Bonn: *Clone Removal… as Stepwise Unification*; Higo i in.; AntiCopyPaster).

## 2. Paradygmat: pięć warstw, każda mierzona osobno

| Warstwa | Co robi | Jak | Typy | Miara |
|---|---|---|---|---|
| **L1 Dokładne po normalizacji** | „to dosłownie to samo, tylko inaczej nazwane” | drzewo składni z zamienionymi nazwami i stałymi na znaczniki → odcisk; CSS: deklaracje rozwinięte (skróty → pełne), wartości znormalizowane (kolory, jednostki, kolejność) → odcisk | 1–2, CSS | precyzja ~100% z konstrukcji; mapa zmian nazw jako dowód |
| **L2 Prawie kopie** | „kopia, w której ktoś coś dopisał lub zmienił” | porównanie znormalizowanych ciągów (diff drzewa), procent wspólnych linii, kto zawiera kogo | 3, „zawiera” | precyzja na złocie i w labie; diff jako dowód |
| **L3 Kandydaci po sensie** | „to może być ta sama robota” | model wektorowy, top-k sąsiadów (już jest: EMB-15) | 4 (kandydaci) | **odnalezienie partnera w top-20** (dziś 92%) |
| **L4 Rozstrzygnięcie pary** | „tak, to samo” / „wzorzec” / „różne” | sędzia widzący oba kawałki: mały model par (cross-encoder) nauczony na ocenach Qwena — szybki, działa bez karty; Qwen, gdy jest karta; agent jako ostatnie słowo | 3–4 | AP i precyzja na zestawie testowym (cel ≥ sędzia Qwen 0,80), pułapka |
| **L5 Wyjaśnienie i propozycja** | „lewy to kopia prawego; wspólna wersja wyglądałaby tak” | wspólne uogólnienie drzew (szkielet + parametry), kierunek kopii z historii gita (co powstało pierwsze), liczba użyć; CSS: wspólna klasa / lista selektorów | wszystkie | czy propozycja jest poprawna składniowo i typowo; ręczny przegląd na Monorepo-A |

L1 i L2 nie potrzebują modelu. Są szybkie, dokładne i dają wyjaśnienie, czyli dokładnie to, o co chodzi w przykładzie z CSS. Model jest potrzebny tylko dla typu 4, i to w dwóch rolach: L3 znajduje, L4 rozstrzyga.

## 2a. Pokrewne problemy, które ktoś już rozwiązał (research 25.10.2026)

Ten sam kształt problemu — „w dużym zbiorze znajdź pary rzeczy, które są tym samym, mimo że wyglądają inaczej, i powiedz, co z nimi zrobić” — ma kilka dojrzałych dziedzin. Każda doszła do tej samej architektury.

| Dziedzina | Jak rozwiązuje | Co bierzemy | Warstwa |
|---|---|---|---|
| **Łączenie rekordów / entity resolution** (np. „Jan Kowalski, ul. Polna 5” = „J. Kowalski, Polna 5/1”) | dwa etapy: tani **blocking** (zawęża miliony par do tysięcy kandydatów) + dokładny **matcher**, który widzi oba rekordy naraz. Ditto (2020): transformer czytający parę jako jeden tekst, do +29% F1, 96,5% F1 w produkcji na 789 tys. rekordów; blocking modelem wektorowym badany osobno (NAACL 2024) | rozdział L3 (blocking = model wektorowy) i L4 (matcher widzi parę); każdy etap mierzony osobno (blocking: odnalezienie partnera, matcher: precyzja) | L3, L4 |
| **Wyszukiwanie z ponownym rankingiem** (sentence-transformers: retrieve & re-rank) | model wektorowy szybko podaje top-k, cross-encoder (czyta zapytanie i dokument razem) przelicza tylko te k; cross-encoder dokładniejszy, ale za wolny na cały zbiór. Destylacja cross-encodera do modelu wektorowego daje ucznia „konsekwentnie słabszego od nauczyciela” | dokładnie nasze L3 + L4; potwierdza, że model wektorowy nie dogoni sędziego par — nie należy go do tego zmuszać | L3, L4 |
| **Duplikaty zgłoszeń błędów** (Eclipse, NetBeans) | wyszukiwanie + klasyfikacja pary; SiameseQAT: Recall@25 71% przy wyszukiwaniu, AUROC 99% przy klasyfikacji pary | ta sama asymetria: wyszukiwanie „gubi” mało, decyzja na parze jest łatwa, gdy model widzi obie strony | L3, L4 |
| **Wykrywanie klonów kodu** | NiCad: normalizacja + „pretty-printing”, potem porównanie linii — wysoka precyzja (0,99) i czytelne wyniki; SourcererCC: indeks tokenów z filtrami, prawie kopie na 250 mln linii, precyzja 86%, wykrywalność 86–100% dla typów 1–3; typ 4: LLM odsiewa, a wykonanie testów potwierdza równoważność (HyClone 2025) | L1/L2 bez modeli, z normalizacją jako dowodem; dla typu 4 opcjonalnie dowód przez uruchomienie (mamy już EMB-04 „dowód wykonaniem”) | L1, L2, L4 |
| **Duplikaty w CSS** — Mazinanian, Tsantalis, Mesbah, *Discovering Refactoring Opportunities in CSS* (FSE 2014); CSSDev (ICSE 2017); migracja do mixinów (ASE 2016) | trzy typy: **I** — te same wartości (kolejność wartości bez znaczenia), **II** — wartości równoważne (`white` = `#fff`, `padding: 2px 4px` = `2px 4px 2px 4px`), **III** — zestaw pojedynczych właściwości = skrót (`border-bottom-*` = `border-bottom`). Usuwanie: wydzielenie **wspólnego selektora grupującego**; warunek bezpieczeństwa: zachowanie **zależności kolejności** (kaskada) rozwiązywane jako problem z ograniczeniami. Badanie: 38 systemów, 91 plików, duplikacja powszechna. Wariant z różnicami: **mixin z parametrami** (typowo 3 deklaracje, 1 parametr) | L1 dla CSS dokładnie wg typów I–III; L5: propozycja selektora grupującego albo mixinu, z warunkiem zależności kolejności | L1, L5 |
| **Refaktoryzacja klonów** — Tsantalis, Mazinanian, Krishnan, *Assessing the Refactorability of Software Clones* (TSE 2015); JDeodorant (ICSE 2016) | dopasowanie instrukcji dwóch klonów, różnice zamieniane na parametry tylko wtedy, gdy to bezpieczne (bez efektów ubocznych); klony uznane za refaktoryzowalne naprawdę dały się zrefaktoryzować bez błędów kompilacji i testów; ponad milion par z 4 detektorów; klony w kodzie produkcyjnym częściej refaktoryzowalne niż w testach. Różnice w 1–2 małych miejscach: lambda zamiast wzorców projektowych (Bonn) | L5: szkic wspólnej funkcji tylko po sprawdzeniu, że różnice da się bezpiecznie sparametryzować; poziom pewności „da się / nie da się bez zmian zachowania” | L5 |
| **Uogólnianie kodu w przemyśle** — Getafix (Facebook): wzorce poprawek przez grupowanie hierarchiczne + **anti-unification** („dziura” h0 w miejscu różnicy, preferowane najbardziej szczegółowe wzorce); Aroma (Facebook): szybkie wyszukiwanie po cechach drzewa → ponowny ranking i grupowanie → **część wspólna** grupy jako rekomendacja | L5: wspólne uogólnienie drzew składni (szkielet + dziury = parametry); grupowanie wielu kopii w jedną grupę i część wspólna jako „wersja wzorcowa” | L5 |

**Co z tego wynika dla nas.**
1. Architektura z §2 nie jest naszym wymysłem — to standard w każdej dziedzinie, która rozwiązała ten problem: tanie wyszukiwanie kandydatów + dokładna decyzja na parze + osobne miary.
2. Dla CSS istnieje gotowa, opisana definicja typów (I–III) i bezpiecznej refaktoryzacji (selektor grupujący, mixin, zależności kolejności). Implementujemy ją, nie wymyślamy.
3. Dla propozycji w kodzie istnieje gotowa metoda (dopasowanie instrukcji + bezpieczna parametryzacja różnic + anti-unification). Szkic proponujemy tylko, gdy jest bezpieczny; w przeciwnym razie znalezisko mówi „to samo, ale nie da się scalić bez zmiany zachowania” — też cenna informacja.
4. Model wektorowy zostaje tym, czym jest w tych systemach: szybkim filtrem kandydatów. Destylacja do niego nigdy nie dogania sędziego par — to znany wynik, nie nasz błąd.

## 3. Czego przestajemy robić

- **Trenować modelu wektorowego na rozróżnianie wzorca od duplikatu.** Trzy przebiegi pokazały granicę. Jego trening, jeśli w ogóle, będzie celował w odnalezienie partnera w top-k.
- **Mierzyć postępu jedną liczbą AP par.** Każda warstwa ma swoją miarę, a całość ocenia przegląd raportu na Monorepo-A i scenariusze w labie.

## 4. Decyzje maintainera

1. **„Sygnały, nie recepty” (AGENTS.md).** Dziś znalezisko mówi tylko *gdzie i dowód*. Cel projektu to *propozycje ujednoliceń i refaktorów*. Propozycja: znalezisko niesie **szkic** wspólnej wersji (szkielet + parametry + mapa nazw) jako dowód. Dustmap nadal nigdy nie zmienia kodu użytkownika (inwariant zostaje). Wymaga zmiany zasady w AGENTS.md — decyzja maintainera.
2. **Sędzia w produkcie.** Mały model par (działa wszędzie, bez karty) jako domyślny; Qwen 7B jako opcja przy karcie (~5 GB pamięci, ok. 7 par/s); agent zawsze może zakwestionować. Alternatywa bez modelu: tylko L1/L2 + kandydaci dla agenta.
3. **Kolejność.** Proponuję najpierw L1+L2+L5 (deterministyczne, od razu użyteczne, w tym CSS), potem L4 (sędzia), na końcu dopieszczanie L3.

## 5. Plan epiku (szkic, do kolejki po decyzjach)

| ID | Co | Miara „zrobione” |
|---|---|---|
| DUP-00 | Ten dokument + decyzje z §4 + zmiana AGENTS.md (jeśli zaakceptowana) | decyzje zapisane |
| DUP-01 | L1: normalizacja drzewa składni TS/JS i deklaracji CSS, odciski, mapa nazw | lab: zaplanowane kopie z inną nazwą / CSS pod innym selektorem — 100% znalezione, 0 fałszywych |
| DUP-02 | L2: prawie kopie i „zawiera” z diffem | złoto: precyzja L2 ≥ 0,95 na parach, które zgłasza |
| DUP-03 | Miernik: odnalezienie partnera w top-k (L3) i miary per warstwa | miernik raportuje L1–L4 osobno |
| DUP-04 | L4: mały model par nauczony na ocenach Qwena (pary z L3, losowa kolejność, ≥ 5 linii, bez testów) | AP na teście ≥ 0,80, ≥ 50 par/s na CPU |
| DUP-05 | L5: wspólne uogólnienie drzew → szkic wspólnej funkcji; kierunek kopii z gita; CSS: propozycja wspólnej klasy | szkic parsuje się i typuje w kopii roboczej; przegląd 30 propozycji na Monorepo-A |
| DUP-06 | Raport i MCP: grupa = warstwa + dowód + szkic; agent widzi „lewy to kopia prawego” | agent kończy pętlę bez czytania dokumentacji |
| DUP-07 | Pomiar na Monorepo-A i w labie, decyzja o domyślnych | przegląd 60 grup: precyzja high ≥ 0,9 |

## Źródła

- HyClone (2025), LLM + uruchomienie dla klonów typu 4: <https://arxiv.org/abs/2508.01357>
- Mapowanie badań nad wykrywaniem klonów przez LLM (BigCloneBench nie nadaje się do oceny typu 4): <https://www.sciencedirect.com/science/article/abs/pii/S0950584926000856>
- Clone Removal in Java Programs as a Process of Stepwise Unification: <https://arxiv.org/pdf/1301.2447>
- AntiCopyPaster 3.0: <https://deepblue.lib.umich.edu/items/46b97888-3fe5-4a23-a05e-d5ce8c5d95ad>
- css-dedup (znormalizowane pary właściwość–wartość): <https://github.com/j9t/css-dedup>; csscss: <https://github.com/nowy10/csscss>
- Skill `train-sentence-transformers` (Hugging Face, Apache-2.0): <https://github.com/huggingface/skills> — część o CrossEncoder (L4) i dystylacji
- Mazinanian, Tsantalis, Mesbah, *Discovering Refactoring Opportunities in Cascading Style Sheets* (FSE 2014): <https://people.ece.ubc.ca/amesbah/resources/papers/fse14.pdf>
- Mazinanian, Tsantalis, *Migrating CSS to Preprocessors by Introducing Mixins* (ASE 2016), slajdy: <https://www.slideshare.net/slideshow/migrating-cascading-style-sheets-to-preprocessors/66025948>
- Tsantalis, Mazinanian, Krishnan, *Assessing the Refactorability of Software Clones* (TSE 2015): <https://bibbase.org/network/publication/tsantalis-mazinanian-krishnan-assessingtherefactorabilityofsoftwareclones-2015>
- Ditto, *Deep Entity Matching with Pre-Trained Language Models*: <https://arxiv.org/pdf/2004.00584>; blocking modelami językowymi (NAACL 2024): <https://preview.aclanthology.org/setup/2024.naacl-long.483>
- Retrieve & Re-Rank (sentence-transformers): <https://sbert.net/examples/applications/retrieve_rerank/README.html>; *Pretrained Transformers for Text Ranking* (destylacja cross-encodera): <https://arxiv.org/pdf/2010.06467>
- Duplikaty zgłoszeń błędów — wyszukiwanie + klasyfikacja: <https://arxiv.org/html/2404.14877v1>, <https://arxiv.org/pdf/2212.00548>
- SourcererCC: <https://arxiv.org/pdf/1512.06448>; przegląd LLM w wykrywaniu klonów (precyzja NiCad / Deckard): <https://arxiv.org/pdf/2308.01191>
- Getafix (anti-unification): <https://engineering.fb.com/developer-tools/getafix-how-facebook-tools-learn-to-fix-bugs-automatically/>; Aroma: <https://engineering.fb.com/2019/04/12/developer-tools/aroma/>; przegląd anti-unification: <https://arxiv.org/pdf/2302.00277>
- Refaktoryzacja klonów z lambdami (C#): <https://arxiv.org/pdf/2512.21511>; historia refaktoryzacji klonów: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9714808/>

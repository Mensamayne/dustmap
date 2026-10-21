# Wyniki: „ten sam sens” na zbiorze wzorcowym (EMB)

Każdy wiersz to jeden przebieg `npm run emb:eval` na zbiorze z `tools/emb/gold` (EMB-01). **same** = ta sama logika (klasa pozytywna); **pattern** i **different** = negatywy. Główna liczba to **AP** (średnia precyzja rankingu: 1,0 = wszystkie pary `same` nad wszystkimi pozostałymi; los ≈ odsetek par `same`). „Brak wyniku” = dostawca w ogóle nie połączył pary (liczone jako 0). Zbiór `test` jest odłożony — nie trenujemy ani nie stroimy na nim progów.

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

# Pomiar: czy embeddingi znajdują sensowne duplikaty (DUST-15)

**Data:** 15.10.2026 · **Cel:** Monorepo-A (`../monorepo-a`, tylko odczyt, kopia plików w `.tmp/spike/corpus/`)

## Ustawienia

| | |
|--|--|
| Narzędzie | jscpd 5.4.1 (natywny, Rust), `--semantic --semantic-scope same --kind semantic` |
| Model | `jina-embeddings-v2-base-code` (lokalnie, CPU; 324 MB, był już pobrany) |
| Korpus | tylko pliki z rolą `source` (DUST-20) z `‹private›/**` i `packages/*/src/**`, bez martwego `‹private›` — 4817 plików, 35 MB |
| Sprzęt | 16 wątków CPU; GPU (RTX 4070 Ti) zajęte przez inny proces, PyTorch tylko CPU — liczenie na GPU nie było możliwe |

## Przebieg 1 — `‹private›` (176 plików, 28 tys. linii)

`--min-tokens 50 --min-lines 8`, wątki automatycznie. **Czas: 270 s.** Wynik: 26 par.

Ocena ręczna 16 par z trzech pasm podobieństwa (czytany kod obu stron):

| # | Podob. | Para | Werdykt | Dlaczego |
|---|--------|------|---------|----------|
| 0 | 0.957 | (prywatny kod) | pattern | ta sama metoda w dwóch adapterach jednego portu (plik vs pamięć) |
| 1 | 0.873 | (prywatny kod) | **real** | dwa parsery „ostatniej wiadomości użytkownika”; jeden obsługuje treść jako tablicę części, drugi nie — rozjazd zachowania |
| 2 | 0.869 | (prywatny kod) | pattern | dwa dekoratory strumienia, różna robota |
| 3 | 0.839 | (prywatny kod) | **real** | dwa parsery tych samych danych, jeden ostry, drugi pobłażliwy |
| 4 | 0.834 | (prywatny kod) | **real** | dwa magazyny zapisują pokwitowania tej samej tury |
| 6 | 0.829 | (prywatny kod) | **real** | dwie różne polityki zgody — dwa źródła prawdy |
| 7 | 0.828 | (prywatny kod) | **real** | jak #4: druga kopia zapisu zgód tej samej tury |
| 11 | 0.808 | (prywatny kod) | **real** | ta sama logika „zapisz wywołanie modelu” dla dwóch interfejsów modelu, skopiowany try/catch |
| 12 | 0.799 | (prywatny kod) | pattern | dwie fabryki magazynów |
| 14 | 0.791 | (prywatny kod) | noise | oba tylko wołają tę samą funkcję |
| 15 | 0.791 | (prywatny kod) | **real** | dwa bufory zużycia „zużyj raz”, inne nazwy pól |
| 17 | 0.790 | (prywatny kod) | noise | odwrotne mapowania, nie duplikat |
| 18 | 0.784 | (prywatny kod) | pattern | trywialne porty w pamięci |
| 20 | 0.780 | (prywatny kod) | pattern | dwie różne bariery |
| 21 | 0.772 | (prywatny kod) | **real** | dwa sposoby „zbierz tekst odpowiedzi modelu” |
| 22 | 0.765 | (prywatny kod) | noise | różne funkcje |

**Trafność:** 8 / 16 `real` (50%), 5 `pattern`, 3 `noise`. Według pasm: ≥ 0.82 → 5 / 7 real; 0.79–0.82 → 2 / 6; < 0.79 → 1 / 3.

**Wartość dodana:** jscpd w trybie tokenowym na tym samym katalogu (1 s, 31 klonów) **nie znalazł żadnej z 8 prawdziwych par**. Embeddingi znajdują coś, czego zwykłe porównanie tekstu nie widzi.

**Najcenniejszy wzorzec:** pary #4, #7 i kolejne (#9, #13, #23 — nieoceniane, ten sam układ plików) łączą te same dwa pliki: `‹private›` ↔ `‹private›`. To nie pięć duplikatów, tylko **jeden: dwa równoległe systemy zapisu tury**. Raport powinien grupować pary po parze plików.

## Przebieg 2 — próbka z `‹private›` (670 plików, 102 tys. linii)

Katalogi: `actions`, `auth`, `‹private›`, `‹private›`, `core`. `--min-tokens 80 --min-lines 15`. **1279 funkcji, czas 985 s (1,3 funkcji/s).** Wynik: 121 par (≥ 0.85: 50; 0.82–0.85: 19; 0.79–0.82: 30; < 0.79: 22).

| # | Podob. | Para (względem `‹private›/…`) | Werdykt | Dlaczego |
|---|--------|------|---------|----------|
| 0 | 0.996 | (prywatny kod) | **real** | ta sama funkcja skopiowana do 3 akcji, różni się tylko kluczem komunikatu |
| 5 | 0.963 | (prywatny kod) | **real** | ~80 linii skopiowanego odczytu zużycia, różni się tylko wyborem tenanta |
| 12 | 0.926 | (prywatny kod) | **real** | serwer i UI osobno łatają tę samą część „dokument” w wiadomościach |
| 25 | 0.908 | (prywatny kod) | **real** | ta sama procedura „upewnij się, że lokalny użytkownik istnieje”, inna rola |
| 40 | 0.874 | (prywatny kod) | **real** | dwa budowniczowie podglądu miksu, już się rozjechały (inny domyślny `roleKey`, brak `type`) |
| 55 | 0.841 | (prywatny kod) | pattern | wspólny początek handlera akcji, dalej inna logika |
| 64 | 0.827 | (prywatny kod) | pattern | ten sam wstęp „sprawdź uprawnienie”, reszta różna |
| 72 | 0.815 | (prywatny kod) | pattern | wstęp handlera |
| 80 | 0.808 | (prywatny kod) | **real** | skopiowane sprawdzanie sesji, roli i użytkownika w dwóch akcjach admina |
| 90 | 0.802 | (prywatny kod) | pattern | podobne przejście po składnikach, inny wynik |
| 100 | 0.786 | (prywatny kod) | pattern | deklaracje akcji w rejestrze zawsze wyglądają podobnie |
| 108 | 0.772 | (prywatny kod) | noise | dwie warstwy jednego modułu |
| 114 | 0.759 | (prywatny kod) | pattern | ten sam wzorzec blokady „w toku” |
| 120 | 0.750 | (prywatny kod) | noise | różne kroki startu |

**Trafność w przebiegu 2:** ≥ 0.85 → **5 / 5 real**; 0.82–0.85 → 0 / 2; 0.79–0.82 → 1 / 3; < 0.79 → 0 / 4.

**Wartość dodana:** jscpd tokenowy na tej samej próbce (1 s, 69 klonów) pokrywa tylko 12 z 50 par ≥ 0.85. Z 6 prawdziwych par z tego przebiegu 4 znalazł **tylko** tryb semantyczny (#0, #12, #25, #40). Uwaga: #0 i #25 to w praktyce kopiuj-wklej z innymi literałami — tryb tokenowy z domyślnymi ustawieniami ich nie łapie.

## Pamięć wektorów (cache)

Ponowny przebieg 1 bez zmian w kodzie: **565 funkcji, wszystkie z pamięci, 0,08 s** (zamiast 270 s). Koszt płaci się raz; potem liczone są tylko zmienione funkcje.

## Łącznie (30 ocenionych par)

| Pasmo podobieństwa | Ocenione | real | pattern | noise |
|--------------------|----------|------|---------|-------|
| ≥ 0.85 | 8 | **6** (75%) | 2 | 0 |
| 0.82–0.85 | 6 | **4** (67%) | 2 | 0 |
| 0.79–0.82 | 8 | 3 (38%) | 3 | 2 |
| < 0.79 | 8 | 1 (13%) | 4 | 3 |

Najczęstszy fałszywy alarm to **wzorzec**, nie losowy szum: wstępy handlerów akcji, deklaracje `defineAction`, adaptery jednego portu, fabryki magazynów. To kod podobny z założenia.

## Decyzja dla DUST-05

1. **Domyślnie włączone**, model `jina-embeddings-v2-base-code` (Apache-2.0, 324 MB, lokalnie). Próg w obrębie języka: **0.82**. Pewność znaleziska: ≥ 0.85 → `medium`, 0.82–0.85 → `low`. Poniżej 0.82 nie raportujemy (4 trafienia na 16). `high` dopiero, gdy zbiór prawdy (DUST-16) pokaże ≥ 90% na większej próbce.
2. **Grupowanie po parze plików i po funkcji**: kilka par między tymi samymi dwoma plikami to jedno znalezisko „dwa równoległe systemy” (np. `‹private›` ↔ `‹private›`). Jedna funkcja w N kopiach (#0: apply / reject / extend) to jedna grupa z N miejscami.
3. **Koszt to główne ryzyko, nie trafność.** CPU: 1,3–2,1 funkcji/s. Pełny kod produktu Monorepo-A (~4,8 tys. plików) to szacunkowo ~2 godziny za pierwszym razem. Stąd:
   - pierwszy pełny skan semantyczny to jawny krok „budowania indeksu” w tle z postępem; zwykły `scan` korzysta z pamięci wektorów,
   - tryb `diff` liczy tylko zmienione funkcje (sekundy),
   - opcja `semantic.provider: http` (API zgodne z OpenAI, np. lokalna Ollama na GPU) jako szybka droga; nie domyślna.
4. **Wzorce celowe:** domyślnie obniżać pewność par, w których obie strony to ten sam rodzaj deklaracji (wywołanie tej samej fabryki z obiektem konfiguracyjnym, np. `defineAction({...})`). Reguła ogólna, bez listy nazw.
5. **Otwarte:** porównanie z `CodeRankEmbed` (domyślny model jscpd 5.4, MIT, 548 MB do pobrania) — wymaga zgody maintainera na pobranie; jscpd twierdzi, że znajduje więcej przy tej samej precyzji.

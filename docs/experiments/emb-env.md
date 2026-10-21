# Środowisko treningowe EMB — lista pobrań do zgody (EMB-02)

**Stan:** zgoda udzielona 21.10.2026 — cytat maintainera: „Zgoda na EMB-02: miejsce E:\dustmap-emb-data, pobrania P1–P5 i wagi W2–W4. trust_remote_code dopiero po Twoim przeglądzie kodu każdego modelu.”

Ten plik mówi z góry, co trzeba ściągnąć z internetu, żeby douczać model „ten sam sens” na karcie graficznej. Przy każdej pozycji podaję skąd, ile waży (w przybliżeniu — dokładny rozmiar podaje instalator) i na jakiej licencji. Zgoda jest per pozycja: zaznacz `[x]` albo napisz w rozmowie, które pozycje — agent zacytuje to w notatce zamknięcia.

## Co jest już na komputerze (21.10.2026)

| | |
|--|--|
| Karta | NVIDIA GeForce RTX 4070 Ti, 12 GB, sterownik 610.88 — **inny proces zajmuje ~7 GB** (tak samo przy DUST-15); na trening zostaje ~5 GB, chyba że ten proces zostanie zamknięty na czas treningu |
| Python | 3.10, 3.11.9, 3.13 (`py -0`); `uv` 0.12.5 |
| PyTorch | 2.9.1 **tylko CPU**, w globalnym Pythonie 3.13 (profil użytkownika) — nie ruszamy go |
| Model obecny | `jina-embeddings-v2-base-code` (310 MB) w pamięci jscpd — tego używa dzisiejszy Dustmap |
| Dysk | C: 67 GB wolne (97% zajęte) · D: 151 GB · **E: 413 GB** |

## Decyzja 1 — gdzie leżą rzeczy

| Co | Propozycja | Ile |
|----|-----------|-----|
| Kod treningu (Python, małe pliki, git) | `C:\Users\lukas\JAVA-VS\dustmap-emb` (obok Dustmapa) | < 1 MB |
| Środowisko Pythona, wagi modeli, dane, checkpointy | **`E:\dustmap-emb-data`** (`venv\`, `hf-cache\`, `data\`, `runs\`) — C: jest prawie pełny | ≤ 25 GB łącznie |

- [x] zgoda na **E:\dustmap-emb-data**

## Decyzja 2 — pobrania (Python, osobne środowisko `venv`, globalny Python nietknięty)

Środowisko na Pythonie **3.11** (najszersze wsparcie bibliotek ML na Windows), tworzone przez `uv venv` w miejscu z decyzji 1.

| # | Co | Skąd | Rozmiar (≈) | Licencja | Po co | Zgoda |
|---|----|------|-------------|----------|-------|-------|
| P1 | PyTorch z CUDA 12.x (`torch`) | download.pytorch.org (oficjalne koła) | 2,5–3,5 GB pobrania, ~5 GB po instalacji | BSD-3-Clause | trening na karcie graficznej | [x] |
| P2 | `transformers`, `tokenizers`, `safetensors` | PyPI (Hugging Face) | ~30 MB | Apache-2.0 | ładowanie modeli i tokenizerów | [x] |
| P3 | `sentence-transformers`, `accelerate`, `datasets` | PyPI | ~40 MB + zależności | Apache-2.0 | trening kontrastowy, dane | [x] |
| P4 | `onnx`, `onnxruntime`, `optimum` | PyPI | ~60 MB | Apache-2.0 / MIT | eksport i kwantyzacja (EMB-07) | [x] |
| P5 | `numpy`, `scikit-learn` | PyPI | ~60 MB | BSD-3-Clause | metryki, podziały danych | [x] |

## Decyzja 3 — wagi kandydatów na model bazowy (EMB-03)

Do pobrania **tylko** wagi (pliki `safetensors` + tokenizer) do `hf-cache` z decyzji 1. Licencje i rozmiary sprawdzam u źródła (karta modelu, plik LICENSE) w EMB-03 przed pobraniem — tu stan wiedzy, nie potwierdzenie.

| # | Model | Skąd | Rozmiar (≈) | Licencja (do potwierdzenia) | Uwagi | Zgoda |
|---|-------|------|-------------|-----------------------------|-------|-------|
| W1 | `jinaai/jina-embeddings-v2-base-code` | Hugging Face | 0 — już jest (310 MB) | Apache-2.0 | obecny model; punkt odniesienia | — |
| W2 | `nomic-ai/CodeRankEmbed` | Hugging Face | ~550 MB | MIT | domyślny w jscpd 5.4; DUST-15 zostawił go do sprawdzenia | [x] |
| W3 | `Salesforce/codet5p-110m-embedding` | Hugging Face | ~450 MB | BSD-3-Clause | mały, uczony na kodzie | [x] |
| W4 | `microsoft/unixcoder-base` | Hugging Face | ~500 MB | Apache-2.0 | bez własnego kodu, czysty RoBERTa | [x] |

**Uwaga bezpieczeństwa:** część modeli kodu (prawdopodobnie W1–W3) wymaga przy ładowaniu `trust_remote_code=True` — wtedy wykonuje się kod Pythona z repozytorium modelu. To osobna zgoda, per model, po przeczytaniu tego kodu w EMB-03:

Maintainer: „trust_remote_code dopiero po Twoim przeglądzie kodu każdego modelu”. Przegląd (21.10.2026) poniżej.

## Co pobrano (21.10.2026)

| # | Co | Wersja / commit | Na dysku | Uwagi |
|---|----|-----------------|----------|-------|
| — | Python | 3.11.16 (`uv`, już zainstalowany, bez pobierania) | — | `E:\dustmap-emb-data\venv` |
| P1 | `torch` | 2.11.0+cu128 (2,6 GB pobrania) | venv razem 4,7 GB | `torch.cuda.is_available()` → RTX 4070 Ti |
| P2–P5 | 57 paczek | dokładne wersje: `dustmap-emb/requirements.lock.txt` | (w venv) | m.in. transformers 5.20.2, sentence-transformers 6.1.0, onnxruntime 1.31.0 |
| W2 | `nomic-ai/CodeRankEmbed` | `3c4b6080` (main) | 523 MB | licencja z karty: **MIT** |
| W3 | `Salesforce/codet5p-110m-embedding` | `2f65533c` = PR #6 od **SFconvertbot** | 421 MB | main ma tylko `pytorch_model.bin` (pickle); `safetensors` z oficjalnego bota konwersji HF; licencja z karty: **BSD-3-Clause** |
| W4 | `microsoft/unixcoder-base` | `558aa506` = PR #8 od **SFconvertbot** | 482 MB | jak W3; licencja z karty: **Apache-2.0** |

Pobierane są tylko wagi `safetensors`, tokenizer, konfiguracja, karta modelu i pliki `.py` do przeglądu — nigdy pickle (`.bin`, `.pt`). Skrypt: `dustmap-emb/fetch-models.py`. Pamięć Hugging Face: `E:\dustmap-emb-data\hf-cache` (1,4 GB).

## Przegląd `trust_remote_code` (21.10.2026)

| Model | Własny kod | Co robi | Werdykt |
|-------|-----------|---------|---------|
| W4 unixcoder | brak | czysty RoBERTa z `transformers` | nie potrzebuje `trust_remote_code` |
| W3 codet5p | 2 pliki, 125 linii (przeczytane w całości) | `T5EncoderModel` z `transformers` + `Linear(768→256)` + normalizacja; zero sieci, plików, procesów, `eval`/`exec` | **bezpieczny**. Lepiej: złożyć go własnym kodem (ten sam enkoder + warstwa) i nie włączać `trust_remote_code` wcale — tak robimy |
| W2 CodeRankEmbed | 2 pliki, 1272 linie (importy i całe ładowanie wag przeczytane; reszta to architektura modelu) | własna architektura NomicBERT; zero `exec`, procesów, gniazd. **Ale:** własne `from_pretrained` z nazwą z huba samo pobiera `pytorch_model.bin` i ładuje go `torch.load` (pickle); z lokalnej ścieżki czyta tylko `model.safetensors` | **bezpieczny pod warunkami:** ładowanie wyłącznie z lokalnej ścieżki migawki + `HF_HUB_OFFLINE=1` (żadnej sieci przy ładowaniu). **Wymaga `einops`** (MIT, mała czysto-pythonowa biblioteka) — **nie było jej na liście, czeka na zgodę** |

- [x] zgoda na pobranie `einops` (MIT, ~60 KB) — potrzebne tylko dla W2. Maintainer 21.10.2026: „Zgoda na einops dla W2.” Zainstalowane: `einops==0.8.2`.

## Sprawdzenie środowiska (21.10.2026)

`python env-check.py` w `E:\dustmap-emb-data\venv`:

```
OK Python 3.11.16 (venv)
OK GPU: NVIDIA GeForce RTX 4070 Ti, 12.0 GB (zajęte 6.9 GB), sterownik 610.88
OK PyTorch: 2.11.0+cu128 CUDA 12.8 → NVIDIA GeForce RTX 4070 Ti
OK Dysk E:\dustmap-emb-data: 407.8 GB wolne (budżet 25 GB)
OK Paczki: wszystkie
GOTOWE do treningu na GPU
```

Globalny Python 3.13 (z PyTorch CPU) nietknięty.

## Próba treningu (`python smoke.py`, 21.10.2026)

100 kroków uczenia kontrastowego na karcie, model W4 (unixcoder, bez własnego kodu), 200 trywialnych par syntetycznych (funkcja vs ta sama ze zmienionymi nazwami — **nie** ze zbioru wzorcowego), tryb offline.

| | |
|--|--|
| Krok (16 par, bf16) | **0,167 s** (mediana) |
| Szczyt pamięci karty | **2,75 GB** — mieści się obok procesu, który trzyma ~7 GB |
| Strata | 0,097 → 0,000 (zadanie celowo banalne: test, że cały tor działa, nie jakość) |

Nic nie zostało zapisane — to tylko dowód, że trening na karcie działa.

## Później (nie teraz) — strona Node, EMB-08

Gdy model będzie gotowy: `onnxruntime-node` (MIT, ~60–100 MB) i biblioteka tokenizera dla Node (Apache-2.0). Osobna zgoda w EMB-08, z tym samym formatem tabeli.

## Budżet dysku (E:)

| Co | ≈ |
|----|---|
| środowisko z PyTorch CUDA | 6 GB |
| wagi 3 kandydatów + cache | 2 GB |
| dane treningowe (EMB-04/05) | 2–5 GB |
| checkpointy (rotowane, max 3) | 3–5 GB |
| **razem** | **13–18 GB** (limit epiku 25 GB) |

## Po zgodzie — co zrobi agent

1. `uv venv --python 3.11 <miejsce>\venv` i instalacja pozycji z zaznaczonym `[x]` (wersje przypięte w `pyproject.toml` repo `dustmap-emb`).
2. `python env-check.py` — ma pokazać: karta widoczna w PyTorch, VRAM, wolne miejsce, wersje. Wynik trafia tutaj.
3. `smoke.py` — 100 kroków douczania małego modelu na 200 parach syntetycznych; czas kroku i zużycie VRAM trafiają tutaj.

# Środowisko treningowe EMB — lista pobrań do zgody (EMB-02)

**Stan:** czeka na decyzje maintainera. Nic z tej listy nie zostało pobrane.

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

- [ ] zgoda na **E:\dustmap-emb-data** (albo wpisz inne miejsce: ________)

## Decyzja 2 — pobrania (Python, osobne środowisko `venv`, globalny Python nietknięty)

Środowisko na Pythonie **3.11** (najszersze wsparcie bibliotek ML na Windows), tworzone przez `uv venv` w miejscu z decyzji 1.

| # | Co | Skąd | Rozmiar (≈) | Licencja | Po co | Zgoda |
|---|----|------|-------------|----------|-------|-------|
| P1 | PyTorch z CUDA 12.x (`torch`) | download.pytorch.org (oficjalne koła) | 2,5–3,5 GB pobrania, ~5 GB po instalacji | BSD-3-Clause | trening na karcie graficznej | [ ] |
| P2 | `transformers`, `tokenizers`, `safetensors` | PyPI (Hugging Face) | ~30 MB | Apache-2.0 | ładowanie modeli i tokenizerów | [ ] |
| P3 | `sentence-transformers`, `accelerate`, `datasets` | PyPI | ~40 MB + zależności | Apache-2.0 | trening kontrastowy, dane | [ ] |
| P4 | `onnx`, `onnxruntime`, `optimum` | PyPI | ~60 MB | Apache-2.0 / MIT | eksport i kwantyzacja (EMB-07) | [ ] |
| P5 | `numpy`, `scikit-learn` | PyPI | ~60 MB | BSD-3-Clause | metryki, podziały danych | [ ] |

## Decyzja 3 — wagi kandydatów na model bazowy (EMB-03)

Do pobrania **tylko** wagi (pliki `safetensors` + tokenizer) do `hf-cache` z decyzji 1. Licencje i rozmiary sprawdzam u źródła (karta modelu, plik LICENSE) w EMB-03 przed pobraniem — tu stan wiedzy, nie potwierdzenie.

| # | Model | Skąd | Rozmiar (≈) | Licencja (do potwierdzenia) | Uwagi | Zgoda |
|---|-------|------|-------------|-----------------------------|-------|-------|
| W1 | `jinaai/jina-embeddings-v2-base-code` | Hugging Face | 0 — już jest (310 MB) | Apache-2.0 | obecny model; punkt odniesienia | — |
| W2 | `nomic-ai/CodeRankEmbed` | Hugging Face | ~550 MB | MIT | domyślny w jscpd 5.4; DUST-15 zostawił go do sprawdzenia | [ ] |
| W3 | `Salesforce/codet5p-110m-embedding` | Hugging Face | ~450 MB | BSD-3-Clause | mały, uczony na kodzie | [ ] |
| W4 | `microsoft/unixcoder-base` | Hugging Face | ~500 MB | Apache-2.0 | bez własnego kodu, czysty RoBERTa | [ ] |

**Uwaga bezpieczeństwa:** część modeli kodu (prawdopodobnie W1–W3) wymaga przy ładowaniu `trust_remote_code=True` — wtedy wykonuje się kod Pythona z repozytorium modelu. To osobna zgoda, per model, po przeczytaniu tego kodu w EMB-03:

- [ ] zgoda na `trust_remote_code` dla: ________ (po przeglądzie kodu)

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

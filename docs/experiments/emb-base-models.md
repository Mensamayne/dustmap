# Wybór modelu bazowego (EMB-03)

**Stan:** zaakceptowane 21.10.2026 — baza: `microsoft/unixcoder-base` (W4).
**Data:** 21.10.2026 · **Zbiór:** `tools/emb/gold` (165 par; wyniki na odłożonej części `test`, 113 par) · **Miernik:** `npm run emb:eval`, każdy model przez dostawcę HTTP Dustmapa (`dustmap-emb/compare.py`), bez douczania.

## Kandydaci

Licencje sprawdzone na kartach modeli w pobranych migawkach (pole `license`); szczegóły pobrania i przeglądu kodu: [emb-env.md](emb-env.md).

| # | Model | Parametry | Wagi (fp32) | Licencja | Własny kod (`trust_remote_code`) | Jak ładowany |
|---|-------|----------:|------------:|----------|----------------------------------|--------------|
| W1 | [jinaai/jina-embeddings-v2-base-code](https://huggingface.co/jinaai/jina-embeddings-v2-base-code) | ~161 M | 310 MB | Apache-2.0 | tak (osobne repo z kodem — nie pobierane) | dzisiejsza droga produktu: jscpd `--semantic` |
| W2 | [nomic-ai/CodeRankEmbed](https://huggingface.co/nomic-ai/CodeRankEmbed) | 137 M | 523 MB | MIT | tak — przejrzany; tylko lokalnie i offline; + `einops` | sentence-transformers + łata `get_extended_attention_mask` (kod pod transformers 4.x) |
| W3 | [Salesforce/codet5p-110m-embedding](https://huggingface.co/Salesforce/codet5p-110m-embedding) | 110 M | 421 MB | BSD-3-Clause | tak — przejrzany; **niepotrzebny**: złożony naszym kodem | `T5EncoderModel` + `Linear(768→256)`, wspólne osadzenie sprawdzone |
| W4 | [microsoft/unixcoder-base](https://huggingface.co/microsoft/unixcoder-base) | 126 M | 482 MB | Apache-2.0 | **brak** | czysty RoBERTa z `transformers`, średnia z tokenów |

Wejście obcinane do 512 tokenów (dotyczy 10–11 ze 180 funkcji w zbiorze).

## Wyniki bez douczania

| Model | AP (test) | 95% przedział AP (bootstrap) | AP na 84 parach, które ocenił jscpd | Wykrywalność przy precyzji ≥ 0,90 | przy ≥ 0,75 | Średnio same / pattern / different | GPU | CPU (PyTorch, 8 wątków) |
|-------|----------:|------------------------------|-----------------------------------:|----------------------------------:|------------:|------------------------------------|----:|------------------------:|
| W1 jina (jscpd) | 0,528 | 0,40–0,67 | 0,608 | 2% | 2% | 0,44 / 0,45 / 0,20 | — | 1,3–2,1 fn/s (DUST-15) |
| W2 CodeRankEmbed | 0,548 | 0,43–0,69 | 0,475 | 5% | 5% | 0,54 / 0,47 / 0,24 | 255 fn/s | 7,0 fn/s |
| W3 codet5p | 0,560 | 0,45–0,71 | 0,481 | 5% | 5% | 0,75 / 0,70 / 0,56 | 315 fn/s | 10,2 fn/s |
| **W4 unixcoder** | **0,672** | **0,55–0,82** | **0,666** | 5% | **49%** | **0,63 / 0,47 / 0,32** | **327 fn/s** | **10,7 fn/s** |

Los dałby AP ≈ 0,39 (odsetek par `same`). Bootstrap: 2000 losowań par ze zwracaniem, porównanie w parach na tych samych losowaniach — **W4 wypada lepiej niż każdy z pozostałych w 99,3–100% losowań**.

Odtworzenie: `dustmap-emb/compare.py` + `dustmap-emb/bench.py` (pomiar), potem `node tools/emb/compare-runs.mjs --challenger W4` (AP na wspólnych parach, wykrywalność przy danej precyzji, bootstrap).

## Co z tego wynika

1. **Żaden model bez douczania nie spełnia celu epiku** (precyzja ≥ 0,90 przy ≥ 70% wykrytych par `same`). Przy precyzji ≥ 0,90 każdy znajduje 2–5% — tylko pary prawie identyczne. To potwierdza plan: douczanie na parach „ten sam sens” i trudnych negatywach (EMB-04 → EMB-06).
2. **W4 unixcoder jest wyraźnie najlepszą bazą.** Jedyny, który rozdziela `same` (0,63) od `pattern` (0,47) — przy precyzji 0,75 łapie połowę par, pozostałe 2–5%. Jest też najszybszy i jedyny bez własnego kodu (zero `trust_remote_code`, zero łat).
3. **W2 i W3 są gorsze od dzisiejszego modelu** na tych samych parach (0,48 wobec 0,61). W3 daje wszystkim parom wysokie podobieństwo (różne funkcje średnio 0,56) — słabo rozróżnia. W2 wymaga łaty pod nowe `transformers` i ostrożnego ładowania.
4. **Próg 0,82 jest właściwością modelu, nie stałą.** Dla W4 najlepszy próg (F1) to ~0,43; przy 0,82 wykrywa 9%. Progi wyliczy kalibracja w EMB-09 — tabela wyników przy 0,82 nie jest porównaniem modeli, AP jest.
5. **Szybkość:** na karcie każdy liczy ~250–330 funkcji/s. Na CPU PyTorch daje ~10 fn/s (5× więcej niż dziś); cel ≥ 50 fn/s ma przynieść eksport ONNX + int8 (EMB-07). W4 w int8 to ~125 MB — w limicie 150 MB.

## Rekomendacja

- **Baza: W4 `microsoft/unixcoder-base`** (Apache-2.0, 126 M parametrów, bez własnego kodu, wagi `safetensors` z PR bota konwersji HF, commit `558aa506`).
- **Zapasowa: W1 jina** — druga na wspólnych parach (0,61) i już w produkcie, ale do douczania wymaga jej osobnego repo z kodem modelu (osobna zgoda + przegląd). Sięgamy po nią tylko, jeśli douczanie W4 zawiedzie.
- W2 i W3 odpadają.

**Akceptacja maintainera (21.10.2026):** „Akceptuję microsoft/unixcoder-base (W4) jako model bazowy.”

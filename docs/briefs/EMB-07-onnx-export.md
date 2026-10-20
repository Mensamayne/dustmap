# EMB-07 — Eksport ONNX i odchudzenie

**Queue:** `EMB-07` | **Epic:** EMB | **Segment:** semantic | **Layer:** 7

## Overview

Wytrenowany model działa w Node bez Pythona i bez karty graficznej: jeden plik ONNX (int8) + tokenizer, ≤ 150 MB, ≥ 50 funkcji/s na CPU 16 wątków. Odchudzenie nie może zepsuć wyniku.

## Plan

### Step 1 — Eksport

- **Plik:** `../dustmap-emb/export_onnx.py`
- **Zmiana:** ONNX (fp32) + tokenizer w formacie czytelnym z JS; uśrednianie wektora i normalizacja **wewnątrz** grafu, żeby Node nie musiał ich powtarzać
- **Done when:** wektory ONNX vs PyTorch: podobieństwo cosinusowe ≥ 0,999 na 1000 funkcjach

### Step 2 — Kwantyzacja int8

- **Plik:** `../dustmap-emb/quantize.py`
- **Zmiana:** int8 dynamiczne; porównanie z fp32 na zbiorze wzorcowym
- **Done when:** spadek miernika ≤ 1 pkt proc.; rozmiar i funkcje/s zapisane w `emb-results.md`

### Step 3 — Paczka modelu

- **Plik:** `../dustmap-emb/dist/<model-id>/` (`model.onnx`, `tokenizer.json`, `manifest.json` z sumami SHA-256, wersją, maks. długością wejścia, licencją)
- **Done when:** manifest weryfikowalny jednym skryptem

## Constraints

- Paczka modelu prywatnego oznaczona `private: true` w manifeście; Dustmap odmawia jej publikacji (EMB-11)

## Pliki (scope)

- `../dustmap-emb/**`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
python ../dustmap-emb/export_onnx.py && python ../dustmap-emb/quantize.py
```

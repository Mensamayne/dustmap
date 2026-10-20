# EMB-02 — Środowisko treningowe i zgody

**Queue:** `EMB-02` | **Epic:** EMB | **Segment:** semantic | **Layer:** 2

## Overview

Maintainer jednym poleceniem stawia środowisko do treningu na swojej karcie graficznej, wiedząc z góry, co zostanie pobrane, ile to waży i ile miejsca zajmie. Nic nie pobiera się bez jego „tak”.

## Stan (20.10.2026)

Python 3.10 / 3.11 / 3.13; PyTorch 2.9.1 **tylko CPU**; RTX 4070 Ti 12 GB (sterownik 610.88); C: 69 GB wolne (97% zajęte).

## Plan

### Step 1 — Lista pobrań do zgody

- **Plik:** `docs/experiments/emb-env.md`
- **Zmiana:** tabela: co, skąd, rozmiar, licencja — PyTorch z CUDA, transformers / sentence-transformers / onnx / onnxruntime, wagi kandydatów z EMB-03; łączny budżet dysku ≤ 25 GB; propozycja miejsca (jeśli C: za ciasny — inny dysk)
- **Done when:** maintainer zaznacza zgody w tym pliku (commit maintainera albo jego „tak” w rozmowie, zacytowane)

### Step 2 — Repo treningowe

- **Plik:** `../dustmap-emb/` (osobne repo: `README.md`, `pyproject.toml`, `env-check.py`, `.gitignore` na wagi / dane / checkpointy)
- **Zmiana:** wirtualne środowisko poza globalnym Pythonem; `env-check.py` mówi: GPU widoczne, VRAM, wolne miejsce, wersje
- **Done when:** `python env-check.py` → GPU widoczne w PyTorch; środowisko globalne nietknięte

### Step 3 — Dym

- **Plik:** `../dustmap-emb/smoke.py`
- **Zmiana:** 100 kroków douczania małego modelu na 200 parach syntetycznych na GPU
- **Done when:** czas kroku i zużycie VRAM zapisane w `emb-env.md`

## Constraints

- Zero pobrań bez zgody; zero zmian w globalnym Pythonie i PATH
- Dane prywatne i wagi nigdy w gicie

## Pliki (scope)

- `docs/experiments/emb-env.md`
- `../dustmap-emb/**` (osobne repo)

## Weryfikacja

```bash
python ../dustmap-emb/env-check.py
```

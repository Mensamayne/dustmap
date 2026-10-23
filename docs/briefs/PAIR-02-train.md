# PAIR-02 — Trening głowy na GPU

**Queue:** `PAIR-02` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 2

## Overview

Na wektorach z enkodera EMB-15 uczymy małą głowę 3-klasową. Tylko CUDA. Soft pozytywy nie są klasą „same”.

## Read first

1. `PAIR-00`, `PAIR-01`
2. `docs/experiments/emb-env.md` (GPU only)
3. `../dustmap-emb/train.py` (wzorzec run.json)

## Plan

### Step 1 — Dane + trening

- **Plik:** `../dustmap-emb/pair_head.py`, `../dustmap-emb/configs/pair-head.yaml`
- **Zmiana:** embed złota (validation→train z holdoutem wewnętrznym; test nietknięty do wyboru) paczką EMB-15; MLP; wybór po macro-F1 / AP `same` na holdoucie walidacyjnym. `run.json` z `device` = nazwa GPU.
- **Done when:** checkpoint + `run.json` na `E:\dustmap-emb-data\runs\…`

### Step 2 — Ocena

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** liczby PAIR-01 meter na teście dla checkpointu
- **Done when:** tabela w emb-results

## Constraints

- Brak CUDA = stop; zakaz CPU
- Test złota nie do early-stopping
- Wagi poza gitem

## Pliki (scope)

- `../dustmap-emb/pair_head.py`, `../dustmap-emb/configs/pair-head.yaml`, `docs/experiments/emb-results.md`, `tools/emb/pair-head-eval.mts`

## Weryfikacja

```bash
E:/dustmap-emb-data/venv/Scripts/python.exe env-check.py
E:/dustmap-emb-data/venv/Scripts/python.exe pair_head.py --config configs/pair-head.yaml
npm run emb:pair-eval -- --checkpoint <best>
```

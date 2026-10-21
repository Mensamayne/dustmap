# EMB-15 — Pełny trening, paczka, progi

**Queue:** `EMB-15` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Po EMB-14: pełny trening **zwycięzcy pojedynku W2 `nomic-ai/CodeRankEmbed`** (AP prawdziwy 0,840 na 10% danych vs 0,748 u W4) na nowych danych EMB-13, eksport ONNX (int8 wag), paczka z manifestem i kalibracją. Gotowy model prywatny (publiczny olewamy aż maintainer powie inaczej).

## Read first

1. `docs/briefs/EMB-07-onnx-export.md`, `docs/briefs/EMB-09-calibration.md`
2. `docs/experiments/emb-results.md` — werdykt EMB-14

## Plan

### Step 1 — Pełny trening

- **Plik:** `../dustmap-emb/configs/*.yaml`, przebiegi w `E:\dustmap-emb-data\runs`
- **Zmiana:** pełne dane EMB-13, przepis EMB-14, wybór checkpointu po AP na prawdziwym kodzie
- **Done when:** checkpoint prywatny (i publiczny jeśli odblokowany) + `run.json` / manifest danych

### Step 2 — Paczka ONNX

- **Plik:** `../dustmap-emb/export_onnx.py`, `quantize.py` / `weight_only.py`, `package.py`, `dist/`
- **Zmiana:** fp16 (GPU) + int8 wag (CPU) jak EMB-07/08; weryfikacja zgodności wektorów; rozmiar ≤ 150 MB na wariant CPU
- **Done when:** `verify_package.py` OK; AP ONNX vs PyTorch w limicie z EMB-07

### Step 3 — Progi / kalibracja

- **Plik:** `tools/emb/calibrate.mts`, manifest paczki
- **Zmiana:** pasma `high` / `medium` z części **walidacyjnej** złota (w tym real); zapis w manifeście
- **Done when:** `npm run emb:calibrate -- --model <id>`; `npm run emb:eval -- --provider onnx --model <id> --calibrated` na teście (bez strojenia pod test)

## Constraints

- Model prywatny nie trafia do gita ani do publikacji
- Progów nie dobierać na części `test`
- Publiczny trening / paczka tylko jeśli maintainer zdjął blokadę z EMB-11; inaczej tylko prywatny

## Pliki (scope)

- `../dustmap-emb/**`, `tools/emb/calibrate.mts`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run emb:calibrate -- --model <id>
npm run emb:eval -- --provider onnx --model <id> --calibrated
```

# PAIR-03 — Paczka ONNX z pairHead

**Queue:** `PAIR-03` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 3

## Overview

Paczka prywatna = enkoder EMB-15 + `pair_head.onnx` + progi w manifeście. Dustmap ładuje głowę gdy jest w paczce.

## Plan

### Step 1 — Eksport i manifest

- **Plik:** `../dustmap-emb/package_pair_head.py` (lub rozszerzenie `package.py`), `packages/core/src/semantic/onnx-provider.ts`
- **Zmiana:** eksport głowy do ONNX; pole opcjonalne `pairHead` w manifeście (plik, klasy, progi); SHA w `files`
- **Done when:** paczka w `dist/` + `~/.cache/dustmap/models/`; load bez błędu

## Constraints

- Enkoder bez zmiany wag względem EMB-15 (kopia plików)
- verify SHA jak dziś

## Pliki (scope)

- `../dustmap-emb/package_pair_head.py`, `packages/core/src/semantic/onnx-provider.ts`, `packages/core/fixtures/onnx-model/**` (fixture z mini head jeśli potrzeba testów)

## Weryfikacja

```bash
E:/dustmap-emb-data/venv/Scripts/python.exe package_pair_head.py
# load via openOnnxProvider in unit test / emb:pair-eval --model …
```

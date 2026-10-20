# EMB-09 — Kalibracja: od podobieństwa do pewności

**Queue:** `EMB-09` | **Epic:** EMB | **Segment:** semantic | **Layer:** 9

## Overview

Liczba podobieństwa z modelu staje się uczciwą pewnością w raporcie: `high` tylko tam, gdzie zbiór wzorcowy pokazuje ≥ 90% prawdziwych duplikatów, `medium` / `low` niżej, poniżej progu — nic. Wzorce celowe (wywołanie tej samej fabryki z obiektem, ten sam wstęp handlera) dostają obniżoną pewność ogólną regułą.

## Plan

### Step 1 — Progi z danych

- **Plik:** `tools/emb/calibrate.mts`, `packages/core/src/semantic/calibration.ts`
- **Zmiana:** pasma podobieństwa → pewność wyliczone na części walidacyjnej zbioru wzorcowego (nie na odłożonej); zapis w manifeście modelu (próg zależy od modelu, nie jest stałą w kodzie)
- **Done when:** na odłożonej części: precyzja `high` ≥ 0,90, `medium` ≥ 0,75

### Step 2 — Wzorce

- **Plik:** `packages/core/src/semantic/cluster.ts`
- **Zmiana:** reguła z DUST-15 decyzja 4: obie strony to ta sama struktura deklaracji / ten sam wstęp → pewność o stopień niżej + dowód „wspólny wzorzec”
- **Done when:** ≥ 80% par `pattern` ze zbioru wzorcowego poniżej `medium`

## Constraints

- Bez list nazw (`defineAction` itp.) — tylko struktura drzewa składni

## Pliki (scope)

- `tools/emb/**`, `packages/core/src/semantic/**`, `packages/core/__tests__/**`

## Weryfikacja

```bash
npm run emb:eval -- --provider onnx --model <id> --calibrated
npm run verify
```

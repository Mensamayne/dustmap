# EMB-10 — Pomiar na prawdziwym kodzie i decyzja o domyślnym

**Queue:** `EMB-10` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Nowy model przechodzi przez to samo, przez co przechodzi każda zmiana Dustmapa: pełny skan „po sensie” Monorepo-A i Service-B, lab, poligon. Jeśli wygrywa liczbami, zostaje domyślnym, a stara ścieżka przez jscpd znika w tym samym briefie.

## Plan

### Step 1 — Monorepo-A i Service-B

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** pełny skan semantyczny (dziś ~2 h na CPU) — czas pierwszy i drugi (cache), liczba grup, 30 grup ocenionych ręcznie tak jak w DUST-15
- **Done when:** tabela porównawcza stary vs nowy; precyzja na próbce ≥ 0,85

### Step 2 — Lab i poligon

- **Plik:** `../dustmap-lab/results/*.md`
- **Zmiana:** lab `03` cały zielony (bez 🟡 „EMB”); poligon bez nowych awarii
- **Done when:** wyniki zacommitowane w repo labu

### Step 3 — Domyślny i porządek

- **Plik:** `packages/core/src/config/schema.ts`, `packages/core/src/semantic/**`, `packages/cli/README.md`, `tools/targets/*.dustmap.config.json`
- **Zmiana:** jeśli nowy wygrywa: `provider` domyślnie `onnx` z modelem publicznym; **usunięte** `jscpd-semantic.ts` i ścieżka `local` przez jscpd; cele testowe z włączoną semantyką. Jeśli przegrywa: raport, czego brakuje, i powrót do EMB-04/05
- **Done when:** decyzja maintainera zacytowana w notatce close

## Constraints

- Zero `@deprecated` mostów — zastąpiony kod znika w tym briefie

## Pliki (scope)

- `packages/core/src/**`, `packages/cli/README.md`, `tools/targets/**`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

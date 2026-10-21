# EMB-10 — Pomiar na celach i decyzja o domyślnym

**Queue:** `EMB-10` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Model z EMB-15 przechodzi przez to samo, przez co przechodzi każda zmiana Dustmapa: zestaw testowy (już w mierniku), lab, pełny skan Monorepo-A i Service-B. Jeśli wygrywa liczbami, zostaje domyślnym (na razie ścieżka prywatna / lokalna paczka), a stara ścieżka przez jscpd znika w tym samym briefie.

## Plan

### Step 1 — Zestaw testowy + lab

- **Plik:** `docs/experiments/emb-results.md`, `../dustmap-lab/results/*.md`
- **Zmiana:** `emb:eval` (test + prawdziwy kod) na paczce EMB-15; lab `03` bez 🟡 „EMB”; poligon bez nowych awarii
- **Done when:** liczby w emb-results; wyniki labu zacommitowane

### Step 2 — Monorepo-A i Service-B

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** pełny skan semantyczny — czas pierwszy i drugi (cache), liczba grup, 30 grup ocenionych ręcznie jak w DUST-15
- **Done when:** tabela porównawcza; precyzja na próbce ≥ 0,85

### Step 3 — Domyślny i porządek

- **Plik:** `packages/core/src/config/schema.ts`, `packages/core/src/semantic/**`, `packages/cli/README.md`, `tools/targets/*.dustmap.config.json`
- **Zmiana:** jeśli nowy wygrywa: domyślny dostawca `onnx` (model wg decyzji — dziś prywatny lokalnie); **usunięte** `jscpd-semantic.ts` i ścieżka `local` przez jscpd; cele testowe z włączoną semantyką. Jeśli przegrywa: raport, czego brakuje
- **Done when:** decyzja maintainera w notatce close

## Constraints

- Zero `@deprecated` mostów — zastąpiony kod znika w tym briefie
- Publikacja modelu publicznego nadal EMB-11 (zablokowane)

## Pliki (scope)

- `packages/core/src/**`, `packages/cli/README.md`, `tools/targets/**`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

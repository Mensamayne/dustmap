# EMB-01 — Zbiór wzorcowy par i miernik

**Queue:** `EMB-01` | **Epic:** EMB | **Segment:** semantic | **Layer:** 1

## Overview

Jedna komenda mówi, jak dobry jest dowolny model „po sensie”: precyzja, wykrywalność, odróżnianie wzorców, szybkość. Pierwszy wynik to obecny model (jina przez jscpd) — od niego liczymy postęp. Bez tego briefu żaden trening nie startuje.

## Read first

1. `docs/experiments/embedding-spike.md` — 30 ręcznie ocenionych par (DUST-15)
2. `../dustmap-lab/scenarios/03-ten-sam-sens.mjs` — pary syntetyczne z labu
3. `packages/core/src/semantic/provider.ts` — interfejs `EmbeddingProvider`

## Plan

### Step 1 — Format i źródła par

- **Plik:** `tools/emb/gold/README.md`, `tools/emb/gold/public.jsonl`, `tools/emb/gold/private-refs.jsonl`
- **Zmiana:** para = dwie funkcje + etykieta `same` (ten sam sens) / `pattern` (podobne z założenia) / `different` + źródło. Publiczne (lab, syntetyczne) z treścią; prywatne (Monorepo-A, DUST-15, arkusze `results/poligon/*-do-oceny.md`) jako odnośniki `{repo, sha, path, startLine, endLine}` bez treści. Min. 150 par, w tym ≥ 40 `same` z naprawdę różnym zapisem i ≥ 40 `pattern`
- **Done when:** walidator formatu; zero treści kodu w `private-refs.jsonl`

### Step 2 — Miernik

- **Plik:** `tools/emb/eval.mts`, `package.json` (`npm run emb:eval`)
- **Zmiana:** woła dostawcę przez interfejs produktu; wynik: krzywa precyzja/wykrywalność, precyzja przy progu, odsetek `pattern` pod progiem, funkcje/s, rozmiar modelu; zapis do `docs/experiments/emb-results.md` (tabela przebiegów)
- **Done when:** test negatywny: losowe wektory → wynik bliski przypadku (miernik nie kłamie)

### Step 3 — Wynik bazowy

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** obecny model: jina przez jscpd (pary) i, jeśli zgoda z EMB-02 już jest, jina przez HTTP (wektory)
- **Done when:** tabela z liczbami bazowymi

## Constraints

- Pary odłożone (test) nigdy nie trafiają do treningu (EMB-04/05 sprawdzają brak przecieku po odciskach)
- Prywatna treść kodu tylko lokalnie

## Pliki (scope)

- `tools/emb/**`, `docs/experiments/emb-results.md`, `package.json`, `tools/verify.mjs` (bramki zbioru i miernika)
- `packages/core/src/index.ts`, `packages/core/src/semantic/index.ts` (eksport ścieżki jscpd i dostawcy HTTP dla miernika — bez zmian zachowania)

## Weryfikacja

```bash
npm run emb:eval -- --provider current
npm run verify
```

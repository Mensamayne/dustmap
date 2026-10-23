# PAIR-01 — Kontrakt głowy + miernik

**Queue:** `PAIR-01` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 1

## Overview

Ustalony kontrakt trzech klas i miernik na złocie v2, który ocenia głowę **osobno** od samego podobieństwa cosinusowego — bez podglądania części `test` przy wyborze modelu.

## Read first

1. `docs/briefs/PAIR-00-overview.md`
2. `tools/emb/eval.mts`, `tools/emb/gold-data.mts`
3. `tools/emb/gold/README.md` — etykiety

## Plan

### Step 1 — Mapowanie etykiet

- **Plik:** `packages/core/src/semantic/pair-head.ts` (nowy), `docs/experiments/emb-results.md`
- **Zmiana:** `same`→`same`; `pattern`→`pattern`; `different`|`contains`|`concept`→`other`. Cechy pary: concat wektorów `[a;b;|a-b|;a*b]`.
- **Done when:** eksportowane typy + jedna funkcja cech; notka w emb-results

### Step 2 — Miernik

- **Plik:** `tools/emb/pair-head-eval.mts`, `package.json` (`emb:pair-eval`)
- **Zmiana:** na złocie: accuracy / AP dla klasy `same` vs reszta; confusion `same`/`pattern`/`other`; baseline = próg na samym cosinusie. Selftest na stałych wektorach.
- **Done when:** `npm run emb:pair-eval -- --selftest` zielone; przebieg bez głowy zapisuje baseline cosinus

## Constraints

- Zero strojenia pod `test`; wybór progu tylko na `validation`
- Soft etykiety nie liczą się jako pozytyw „raportuj kopię”
- Scope: tylko pliki poniżej

## Pliki (scope)

- `packages/core/src/semantic/pair-head.ts`, `packages/core/src/semantic/index.ts`, `packages/core/__tests__/pair-head.test.ts`
- `tools/emb/pair-head-eval.mts`, `package.json`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run emb:pair-eval -- --selftest
npm run verify
```

## Wyjście (acceptance)

- [ ] Kontrakt klas + cechy
- [ ] Miernik + selftest
- [ ] Baseline cosinus na validation/test w emb-results

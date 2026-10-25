# DUP-07 — Pomiar na Monorepo-A i w labie, decyzja o domyślnych

**Queue:** `DUP-07` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 5

## Overview

Całość mierzona tam, gdzie się liczy: przegląd 60 losowych grup na Monorepo-A (prawdziwe / wzorzec / szum), scenariusze laboratorium, Service-B (raport krótki). Na tej podstawie ustawienia domyślne warstw i sędziego.

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Przegląd Monorepo-A

- **Plik:** `docs/experiments/dup-results.md`
- **Zmiana:** 60 grup, po 20 z każdej pewności; zapis werdyktów
- **Done when:** precyzja high ≥ 0,9, ≥ medium ≥ 0,8

### Step 2 — Laboratorium

- **Plik:** `../dustmap-lab/**`
- **Zmiana:** wszystkie scenariusze duplikatów zielone
- **Done when:** 0 znanych błędów DUP

### Step 3 — Domyślne

- **Plik:** `packages/core/src/config/schema.ts`, `tools/targets/*.dustmap.config.json`
- **Zmiana:** warstwy i sędzia włączone wg wyników
- **Done when:** decyzja z liczbami w dup-results

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `docs/experiments/dup-results.md`
- `../dustmap-lab/**`
- `packages/core/src/config/schema.ts`
- `tools/targets/*.dustmap.config.json`
- Added during work: `packages/core/src/scan/merge-duplicates.ts`, `packages/core/src/scan/run-scan.ts` (`clones.tokenCopyAloneMax` applied where layers are known); target configs needed no change

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Precyzja na Monorepo-A z przeglądem
- [ ] Lab zielony
- [ ] Domyślne ustawione z uzasadnieniem

## Po zakończeniu

1. Commit `Fixes DUP-07: …`
2. `node tools/queue/close.mjs --id DUP-07 --note "…"`

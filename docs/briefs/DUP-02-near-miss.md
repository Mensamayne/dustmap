# DUP-02 — L2: prawie kopie i „zawiera” z diffem

**Queue:** `DUP-02` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 2

## Overview

Skan zgłasza kopie, w których ktoś coś dopisał lub zmienił (typ 3), oraz parę „ta funkcja zawiera tamtą”. Liczone na odciskach z DUP-01: porównanie znormalizowanych ciągów, procent wspólnych linii, kto zawiera kogo. Dowodem jest diff po normalizacji.

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Podobieństwo znormalizowanych ciągów

- **Plik:** `packages/core/src/clones/near-miss.ts` (nowy) + test
- **Zmiana:** indeks tokenów z filtrami (podejście SourcererCC) zamiast porównania wszystkiego ze wszystkim; próg pokrycia i kierunek zawierania jako parametry
- **Done when:** testy: dopisany krok → „zawiera”; zmieniona linia → prawie kopia; inny szkielet → nic

### Step 2 — Diff jako dowód

- **Plik:** `packages/core/src/clones/near-miss.ts`
- **Zmiana:** linie wspólne / dopisane / zmienione po normalizacji, z mapą nazw
- **Done when:** dowód czytelny dla agenta bez otwierania plików

### Step 3 — Skala

- **Plik:** `packages/core/src/clones/run.ts`
- **Zmiana:** Monorepo-A (~40 tys. jednostek) w rozsądnym czasie
- **Done when:** ≤ 60 s dodatkowo na Monorepo-A, czas zapisany

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `packages/core/src/clones/**`
- `packages/contract/src/finding.ts` (jeśli potrzebny nowy rodzaj)
- `../dustmap-lab/**`
- `docs/experiments/dup-results.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Prawie kopie i „zawiera” z diffem
- [ ] Złoto: precyzja zgłoszeń L2 ≥ 0,95
- [ ] Czas na Monorepo-A zapisany

## Po zakończeniu

1. Commit `Fixes DUP-02: …`
2. `node tools/queue/close.mjs --id DUP-02 --note "…"`

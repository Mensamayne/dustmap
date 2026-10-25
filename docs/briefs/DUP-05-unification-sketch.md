# DUP-05 — L5: szkic ujednolicenia i kierunek kopii

**Queue:** `DUP-05` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 3

## Overview

Do grupy duplikatów dochodzi wyjaśnienie: który kawałek jest kopią którego (historia gita: co powstało pierwsze) i szkic wspólnej wersji. Dla kodu: wspólne uogólnienie drzew składni (anti-unification), różnice jako parametry, tylko gdy parametryzacja jest bezpieczna (Tsantalis i in., TSE 2015). Dla CSS: selektor grupujący albo mixin, tylko gdy zachowane są zależności kolejności (Mazinanian i in., FSE 2014).

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Kierunek kopii

- **Plik:** `packages/core/src/clones/direction.ts` (nowy)
- **Zmiana:** git log tylko do odczytu: data powstania każdego członka grupy
- **Done when:** „B to kopia A (A starsze o N dni)” w dowodach

### Step 2 — Anti-unification TS/JS

- **Plik:** `packages/core/src/clones/unify-ts.ts` (nowy)
- **Zmiana:** wspólny szkielet + dziury; dziury → parametry; odrzucenie, gdy różnica zmienia przepływ sterowania lub efekty uboczne
- **Done when:** szkic parsuje się; testy na kopiach z różnymi stałymi i dopisanym krokiem

### Step 3 — CSS: grupowanie z warunkiem kolejności

- **Plik:** `packages/core/src/clones/unify-css.ts` (nowy)
- **Zmiana:** wspólna reguła `.a, .b { … }` albo mixin z parametrem; sprawdzenie zależności kolejności (selektory nadpisujące te same właściwości)
- **Done when:** testy z przypadkami, gdzie przeniesienie zmieniłoby wygląd → brak szkicu

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `packages/core/src/clones/**`
- `packages/contract/src/finding.ts` (pole szkicu, jeśli potrzebne)
- `../dustmap-lab/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Kierunek kopii w dowodach
- [ ] Szkic TS/JS tylko gdy bezpieczny; parsuje się
- [ ] CSS grupowanie z warunkiem kolejności

## Po zakończeniu

1. Commit `Fixes DUP-05: …`
2. `node tools/queue/close.mjs --id DUP-05 --note "…"`

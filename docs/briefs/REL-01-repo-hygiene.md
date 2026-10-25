# REL-01 — Higiena repo przed publikacją

**Queue:** `REL-01` | **Epic:** REL | **Segment:** release | **Layer:** 1

## Overview

Świeży klon instaluje się `npm ci` i przechodzi `npm run verify`; CLI mówi jednym językiem (angielski); żadnych ścieżek z dysku maintainera.

## Plan

### Step 1 — Zamek i kolejka

- **Plik:** `package-lock.json`, `docs/briefs/CON-03…07`
- **Zmiana:** zamek zgodny z package.json; briefy CON-03…07 (wiersze kolejki już są) w gicie
- **Done when:** świeży klon: `npm ci` i `npm run verify` zielone

### Step 2 — CLI po angielsku

- **Plik:** `packages/cli/src/**`
- **Zmiana:** podpowiedź „dalej:” → „next:”; model list po angielsku
- **Done when:** testy i lab zielone (lab dopasowany do nowych słów)

### Step 3 — Ścieżki lokalne

- **Plik:** `docs/**`
- **Zmiana:** ścieżki domowe → opis względny
- **Done when:** `git grep` nie znajduje ścieżek domowych

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `package-lock.json`, `docs/briefs/CON-0*.md`, `packages/cli/src/**`, `packages/cli/__tests__/**`, `docs/experiments/emb-env.md`, `../dustmap-lab/**`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] `npm ci` + `verify` na świeżym klonie
- [ ] CLI bez polskich słów

## Po zakończeniu

1. Commit `Fixes REL-01: …`
2. `node tools/queue/close.mjs --id REL-01 --note "…"`

- Added during work: niezapisany wpis CON-13 w `docs/experiments/emb-env.md` (log pobrań) i asercja w `packages/cli/__tests__/cli-e2e.test.ts` (skan bez modelu kończy się) — pozostałości wcześniejszej pracy w tych samych plikach

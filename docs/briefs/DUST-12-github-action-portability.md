# DUST-12 — GitHub Action + dowód przenośności

**Queue:** `DUST-12` | **Epic:** DUST | **Segment:** core | **Layer:** 12

## Overview

Ktoś obcy podłącza Dustmap do swojego repo w kilka minut: gotowa akcja GitHuba skanuje pull request w trybie `diff`, wrzuca SARIF do zakładki skanowania kodu i blokuje tylko nowe śmieci. Bramka pilnuje, że w kodzie paczek nie ma wiedzy o żadnym konkretnym projekcie, a licencje zależności pozwalają na publikację.

## Plan

### Step 1 — Akcja

- **Plik:** `packages/cli/action/action.yml`
- **Zmiana:** composite action: `dustmap scan --diff ${{ base }}` → `dustmap export --to sarif` → upload SARIF → `dustmap ratchet`. Wejścia: `config`, `fail-on` (`none|new-high|new-any`).
- **Done when:** przykładowy workflow w README paczki; `actionlint` czysty.

### Step 2 — Bramka izolacji i licencji

- **Plik:** `tools/verify-isolation.mjs`
- **Zmiana:** pada, gdy kod w `packages/*/src` zawiera ścieżki absolutne, importy spoza workspace'u albo nazwy z listy zakazanej (`tools/isolation-denylist.json`, na start: nazwy projektów maintainera); licencje zależności produkcyjnych tylko MIT / ISC / Apache-2.0 / BSD.
- **Done when:** test negatywny: wstrzyknięta zakazana nazwa → bramka czerwona; zależność GPL → czerwona.

### Step 3 — Skan obcego repo

- **Plik:** `packages/core/__tests__/foreign-repo.test.ts`
- **Zmiana:** `npm pack` paczek, instalacja w katalogu tymczasowym, `dustmap init && dustmap scan` na fixture Next → raport poprawny wg kontraktu.
- **Done when:** test zielony na Windows i Linux.

## Constraints

- Akcja nigdy nie commituje do repo użytkownika

## Pliki (scope)

- `packages/cli/action/**`, `packages/cli/README.md`
- `packages/core/__tests__/**`
- `tools/verify-isolation.mjs`, `tools/isolation-denylist.json`
- `package.json` (`verify` += izolacja)

## Weryfikacja

```bash
npm run verify
```

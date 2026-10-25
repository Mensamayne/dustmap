# BUG-14 — Treść jednostek z końcami linii Windows psuje modele (sędzia par: 0,998 → 0,022)

**Queue:** `BUG-14` | **Kind:** bug | **Warstwa:** 100 | **Segment:** semantic | **Severity:** high | **Epik:** BUG

**Źródło:** DUP-08, przegląd par sędziego na Monorepo-A, 2026-10-25

## Overview

Naprawić bug: skan tnie funkcje, fragmenty i klasy razem z końcami linii pliku. Na Windowsie (checkout z `core.autocrlf`, a także migawka `git archive`) to `\r\n` — w migawce Monorepo-A 10 883 z 10 886 plików skryptów. Modele uczyły się na tekście z `\n` (dane treningowe, złoto: `split(/\r?\n/).join("\n")`). Sędzia par na tej samej parze (sortowanie topologiczne jako `.js` i `.ts`): z `\n` 0,998, z `\r\n` 0,022 — w skanie zdegradował prawdziwe duplikaty. Model wektorowy dostaje ten sam tekst. Miernik tego nie widział, bo karmił modele tekstem z `\n`.

## Read first

1. `packages/core/src/semantic/extract.ts` — `stripComments`, wspólne źródło treści jednostek (`extractFunctions`, `units.ts`)
2. `docs/experiments/dup-results.md` (DUP-08)

## Plan

### Step 1 — reproduce and locate

- **Plik:** `packages/core/src/semantic/extract.ts`
- **Zmiana:** treść jednostki zachowuje `\r` z pliku; każda ścieżka do modeli (wektory, sędzia) przechodzi przez `stripComments`
- **Done when:** root cause opisany

### Step 2 — fix at source

- **Plik:** `packages/core/src/semantic/extract.ts`, `packages/core/src/semantic/run.ts` (wersja adaptera: nowa treść = nowe wektory)
- **Zmiana:** `stripComments` zwraca tekst z końcami linii `\n`
- **Done when:** ten sam tekst w skanie co w treningu

### Step 3 — regression guard

- **Plik:** `packages/core/src/semantic/*.test.ts`
- **Zmiana:** jednostka z pliku `\r\n` ma treść bez `\r`, ten sam hash co z pliku `\n`
- **Done when:** test zielony

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- **Anty-maskowanie:** zakaz `--exclude`, `.skip`, `.only`, `it.todo` w testach i bramkach
- Symptom patch (clamp/trim) gdy bug jest upstream — zakaz
- Naprawa „przy okazji” innych epików — zakaz

## Pliki (zamknięta lista)

- `packages/core/src/semantic/extract.ts`
- `packages/core/src/semantic/run.ts`
- `packages/core/src/semantic/*.test.ts`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Bug naprawiony minimalnym diffem w plikach z listy
- [ ] Weryfikacja zielona (output w close report, nie deklaracja)

## Po zakończeniu

1. Commit `Fixes BUG-14: …`
2. `npm run queue:close -- --id BUG-14 --note "…"`

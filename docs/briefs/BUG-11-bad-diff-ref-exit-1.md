# BUG-11 — Zła gałąź bazowa w `scan --diff` kończy się kodem 1 („nowe znaleziska”)

**Queue:** `BUG-11` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** low | **Epik:** BUG

**Źródło:** tortury `T20-zla-baza-diff` 2026-10-20

## Overview

Naprawić bug: `dustmap scan --diff origin/nie-ma-takiej` kończy się kodem **1** z surowym błędem gita. Kod 1 znaczy w CLI „zapadka znalazła nowe znaleziska”, więc skrypt albo akcja GitHuba weźmie literówkę w nazwie gałęzi za nowy kurz. Przyczyna ogólna: `main.ts` zamienia każdy nieoczekiwany wyjątek na kod 1.

## Read first

1. `packages/cli/src/main.ts` — `catch` → `return 1`
2. `packages/core/src/scan/git.ts` — `gitDiffNameOnly` (merge-base, potem `git diff`)

## Plan

### Step 1 — fix at source

- **Plik:** `packages/core/src/scan/git.ts`, `packages/cli/src/scan-cmd.ts`, `packages/cli/src/main.ts`, `packages/cli/src/args.ts`
- **Zmiana:** baza sprawdzana przed skanem (`git rev-parse --verify <ref>^{commit}`) → kod 2 z nazwą bazy; nieoczekiwany wyjątek nigdy nie daje kodu 1 (osobny kod opisany w `--help` i README)
- **Done when:** zła baza → kod 2 i czytelny komunikat; kod 1 tylko z `ratchet`

### Step 2 — regression guard

- **Plik:** `packages/cli/__tests__/cli-e2e.test.ts`
- **Zmiana:** test złej bazy
- **Done when:** test zielony; tortura `T20` bez 🟡

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`

## Pliki (zamknięta lista)

- `packages/core/src/scan/git.ts`
- `packages/cli/src/main.ts`, `packages/cli/src/scan-cmd.ts`, `packages/cli/src/args.ts`, `packages/cli/README.md`
- `packages/cli/__tests__/cli-e2e.test.ts`

## Weryfikacja

```bash
npm run verify
```

## Po zakończeniu

1. Commit `Fixes BUG-11: …`
2. `node tools/queue/close.mjs --id BUG-11 --note "…"`

# BUG-02 — `stale: false` gdy brak HEAD w git

**Queue:** `BUG-02` | **Kind:** bug | **Warstwa:** 100 | **Segment:** agent | **Severity:** medium | **Epik:** BUG

**Źródło:** DUST-18 dogfood — migawka Monorepo-A (`git archive` + `git init` bez commitów)

## Overview

Naprawić bug: gdy `git rev-parse HEAD` się nie uda, MCP/CLI raportuje świeżość jakby raport był aktualny (`stale: false` bez ostrzeżenia) — agent może decydować na nieaktualnych danych.

## Read first

1. `packages/mcp/src/limits.ts` — `reportStaleWarning` zwraca `null` przy `head === null`
2. `packages/cli/src/summary-cmd.ts` — podobna ścieżka komunikatu o wieku raportu

## Plan

### Step 1 — reproduce and locate

- **Plik:** `packages/mcp/src/limits.ts`
- **Zmiana:** zidentyfikuj kontrakt świeżości gdy HEAD nieznany
- **Done when:** root cause opisany (brak rozróżnienia „unknown” vs „matches”)

### Step 2 — fix at source

- **Plik:** `packages/mcp/src/limits.ts`, `packages/mcp/src/tools.ts`, `packages/cli/src/summary-cmd.ts`
- **Zmiana:** jawny stan `stale: "unknown"` albo `headAvailable: false` + ostrzeżenie; nigdy udawane „aktualne”
- **Done when:** fixture bez HEAD nie dostaje `stale: false` bez zastrzeżenia

### Step 3 — regression guard

- **Plik:** `packages/mcp/__tests__/**`, `packages/cli/__tests__/**`
- **Zmiana:** test: repo bez HEAD → odpowiedź mówi, że nie da się potwierdzić świeżości
- **Done when:** test zielony lokalnie

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- **Anty-maskowanie:** zakaz `--exclude`, `.skip`, `.only`, `it.todo`
- Symptom patch (clamp/trim) gdy bug jest upstream — zakaz

## Pliki (zamknięta lista)

- `packages/mcp/src/limits.ts`
- `packages/mcp/src/tools.ts`
- `packages/mcp/__tests__/**`
- `packages/cli/src/summary-cmd.ts`
- `packages/cli/__tests__/**`

## Weryfikacja

```bash
npm run verify
npm run agent-eval
```

## Wyjście (acceptance)

- [x] Bug naprawiony minimalnym diffem w plikach z listy
- [x] Weryfikacja zielona

## Po zakończeniu

1. Commit `Fixes BUG-02: …`
2. `npm run queue:close -- --id BUG-02 --note "…"`

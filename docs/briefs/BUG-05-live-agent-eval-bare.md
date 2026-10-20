# BUG-05 — Harness żywego agenta: `--bare`, brak oceny, brudna migawka

**Queue:** `BUG-05` | **Kind:** bug | **Warstwa:** 100 | **Segment:** agent | **Severity:** medium | **Epik:** BUG

**Źródło:** audyt DUST-18 2026-10-20

## Overview

Naprawić bug: `npm run agent-eval:live` woła `claude -p --bare`. Tryb `--bare` z definicji nie czyta logowania (OAuth), tylko `ANTHROPIC_API_KEY` — więc nawet zalogowany maintainer dostałby „Not logged in”. Tryb żywy ocenia zadanie tylko po kodzie wyjścia (nie sprawdza użytych narzędzi ani limitu wywołań), a zadanie o nieaktualnym raporcie dostaje świeży raport. Harness zapisuje też decyzje „keep” z T05 do wyjścia przypiętej migawki Monorepo-A — kolejne `verify:targets` liczą wtedy na raporcie z wyciszonymi znaleziskami. Sam przebieg z prawdziwym agentem to osobne zadanie (DUST-23), bo wymaga zalogowanego `claude`.

## Read first

1. `tools/agent-eval/run.mjs` — `runLiveAgent`, `main`
2. `claude --help` — `--bare`, `--strict-mcp-config`, `--output-format stream-json`

## Plan

### Step 1 — fix at source

- **Plik:** `tools/agent-eval/run.mjs`
- **Zmiana:** `--bare` tylko gdy jest `ANTHROPIC_API_KEY`; brak logowania wykryty przed startem (`claude auth status`) z komunikatem, co zrobić; zawsze `--strict-mcp-config`; wyjście `stream-json`, z którego liczone są wywołania narzędzi; sukces = kod 0 + wymagane narzędzia z `expect.toolsUsed` + wywołania ≤ `maxCalls`; zadanie na `{{staleOut}}` dostaje katalog nieaktualnego raportu; porażka żywego przebiegu = kod 1
- **Done when:** wynik każdego zadania ma listę użytych narzędzi i powód porażki

### Step 2 — Czysta migawka

- **Plik:** `tools/agent-eval/run.mjs`
- **Zmiana:** decyzje i kolejka trafiają do kopii raportu w `.tmp/agent-eval/out`, nie do wyjścia migawki
- **Done when:** po `npm run agent-eval` w wyjściu migawki nie ma `decisions.yml`

### Step 3 — Raport bez błędnej diagnozy

- **Plik:** `docs/experiments/agent-dogfood.md`
- **Zmiana:** sekcja żywego przebiegu mówi prawdziwą przyczynę i wskazuje DUST-23
- **Done when:** brak zdania „to nie wina narzędzia” bez dowodu

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- Tryb skryptowany (`npm run agent-eval`) bez zmian w wyniku

## Pliki (zamknięta lista)

- `tools/agent-eval/run.mjs`
- `docs/experiments/agent-dogfood.md`

## Weryfikacja

```bash
npm run agent-eval
npm run agent-eval:live   # bez logowania: jeden czytelny błąd i kod 1
```

## Po zakończeniu

1. Commit `Fixes BUG-05: …`
2. `node tools/queue/close.mjs --id BUG-05 --note "…"`

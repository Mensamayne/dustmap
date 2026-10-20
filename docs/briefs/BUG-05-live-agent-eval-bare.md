# BUG-05 — Próba żywego agenta nie mogła się udać (`--bare` wymusza klucz API)

**Queue:** `BUG-05` | **Kind:** bug | **Warstwa:** 100 | **Segment:** agent | **Severity:** medium | **Epik:** BUG

**Źródło:** audyt DUST-18 2026-10-20

## Overview

Naprawić bug: `npm run agent-eval:live` woła `claude -p --bare`. Tryb `--bare` z definicji nie czyta logowania (OAuth), tylko `ANTHROPIC_API_KEY` — stąd „Not logged in” na wszystkich 8 zadaniach. DUST-18 uznał to za problem środowiska, więc dowód „prawdziwy agent umie użyć Dustmapa” nigdy nie powstał. Dodatkowo tryb żywy ocenia zadanie tylko po kodzie wyjścia — nie sprawdza, czy agent użył wymaganych narzędzi i zmieścił się w limicie wywołań. Zadanie o nieaktualnym raporcie dostaje świeży raport.

## Read first

1. `tools/agent-eval/run.mjs` — `runLiveAgent`
2. `claude --help` — opis `--bare`, `--strict-mcp-config`, `--output-format stream-json`

## Plan

### Step 1 — fix at source

- **Plik:** `tools/agent-eval/run.mjs`
- **Zmiana:** `--bare` tylko gdy jest `ANTHROPIC_API_KEY`; zawsze `--strict-mcp-config` (tylko serwer Dustmap); wyjście `stream-json`, z którego liczone są wywołania narzędzi; sukces = kod 0 + wymagane narzędzia z `expect.toolsUsed` + liczba wywołań ≤ `maxCalls`; zadanie ze skryptem na `{{staleOut}}` dostaje katalog nieaktualnego raportu
- **Done when:** wynik każdego zadania ma listę użytych narzędzi i powód porażki

### Step 2 — Przebieg i raport

- **Plik:** `docs/experiments/agent-dogfood.md`
- **Zmiana:** tabela żywego przebiegu z prawdziwymi liczbami; usterki narzędzia → nowe briefy
- **Done when:** każde zadanie: sukces / porażka + przyczyna

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- Agent pracuje tylko na migawce w `.tmp/`; transkrypty tylko w `.tmp/agent-eval/`
- Tryb skryptowany (`npm run agent-eval`) bez zmian w wyniku

## Pliki (zamknięta lista)

- `tools/agent-eval/run.mjs`
- `docs/experiments/agent-dogfood.md`
- `docs/briefs/**` (tylko nowe briefy usterek z przebiegu)

## Weryfikacja

```bash
npm run agent-eval
npm run agent-eval:live
```

## Po zakończeniu

1. Commit `Fixes BUG-05: …`
2. `node tools/queue/close.mjs --id BUG-05 --note "…"` + wynik żywego przebiegu (x/8)

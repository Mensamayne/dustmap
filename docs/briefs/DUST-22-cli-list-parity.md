# DUST-22 — `dustmap list` w CLI: ta sama pętla bez MCP

**Queue:** `DUST-22` | **Epic:** DUST | **Segment:** agent | **Layer:** 22

## Overview

Agent bez MCP (sam terminal, `--json`) przechodzi całą pętlę tak samo jak przez MCP: przegląda znaleziska z filtrem kategorii, ścieżki i pewności, stronami, najpewniejsze najpierw. Dziś CLI nie ma odpowiednika `dustmap_list` — playbook każe „użyć summary --json”, które pokazuje tylko 10 miejsc. To łamie zasadę z AGENTS.md: każda powierzchnia (MCP i CLI `--json`) domyka pętlę. Przy okazji playbook mówi, co zrobić, gdy świeżości nie da się sprawdzić (`stale: "unknown"`, BUG-02), a zadanie „najbezpieczniejsze usunięcia” w agent-eval używa filtra pewności z DUST-21.

## Read first

1. `packages/mcp/src/tools.ts` — `filterFindings` (filtr + sortowanie DUST-21)
2. `packages/cli/src/args.ts`, `packages/cli/src/show-cmd.ts` — wzór komendy czytającej raport

## Plan

### Step 1 — Jedna logika filtra

- **Plik:** `packages/core/src/report/list.ts`, `packages/core/src/index.ts`, `packages/mcp/src/tools.ts`
- **Zmiana:** filtr + sortowanie + stronicowanie przeniesione do rdzenia; MCP woła rdzeń (zero kopii logiki)
- **Done when:** testy MCP `dustmap_list` bez zmian zielone

### Step 2 — Komenda

- **Plik:** `packages/cli/src/list-cmd.ts`, `packages/cli/src/args.ts`, `packages/cli/src/main.ts`, `packages/cli/README.md`
- **Zmiana:** `dustmap list [--category c] [--path p] [--min-confidence low|medium|high] [--offset n] [--limit n] [--out dir] [--json]`; zła wartość = kod 2; tekst kończy się linią „dalej:”
- **Done when:** test e2e: `--category dead-code --min-confidence high --json` zwraca tylko `high`; README ma komendę

### Step 3 — Playbook i agent-eval

- **Plik:** `packages/cli/agent/PLAYBOOK.md`, `tools/agent-eval/tasks.json`, `tools/agent-eval/run.mjs`
- **Zmiana:** wiersz „Browse findings” = `dustmap list`; `stale: "unknown"` opisane; T04 woła `dustmap_list` z `minConfidence: "high"` i wymaga, by cała strona była `high`
- **Done when:** playbook coverage test zielony; `npm run agent-eval` zielone

## Constraints

- Zero wiedzy o konkretnym projekcie w paczkach
- Limit odpowiedzi MCP bez zmian

## Pliki (scope)

- `packages/core/src/report/**`, `packages/core/src/index.ts`, `packages/core/__tests__/**`
- `packages/mcp/src/tools.ts`, `packages/mcp/__tests__/**`
- `packages/cli/src/**`, `packages/cli/__tests__/**`, `packages/cli/README.md`, `packages/cli/agent/PLAYBOOK.md`
- `tools/agent-eval/**`

## Weryfikacja

```bash
npm run verify
npm run agent-eval
```

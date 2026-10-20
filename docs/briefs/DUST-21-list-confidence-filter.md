# DUST-21 — Filtr pewności w `dustmap_list`

**Queue:** `DUST-21` | **Epic:** DUST | **Segment:** agent | **Layer:** 21

## Overview

Agent proszący o „najbezpieczniejsze usunięcia” dostaje stronę martwego kodu bez filtra `confidence`, więc musi zgadywać z pierwszej strony. Filtr (i sortowanie) po pewności w MCP/CLI skraca pętlę bez ściany JSON.

## Plan

### Step 1 — List filter

- **Plik:** `packages/mcp/src/tools.ts`, `packages/cli/src/**` (jeśli powstanie `dustmap list`)
- **Zmiana:** argument `minConfidence` / `confidence` na `dustmap_list`; opcjonalnie sort malejąco po pewności
- **Done when:** test: `minConfidence=high` + `category=dead-code` zwraca tylko high

### Step 2 — Playbook

- **Plik:** `packages/cli/agent/PLAYBOOK.md`
- **Zmiana:** krok „bezpieczne usunięcia” używa filtra pewności
- **Done when:** playbook coverage test zielony

## Constraints

- Zero wiedzy o konkretnym projekcie w paczkach
- Limit odpowiedzi MCP bez zmian (nadal stronicowanie)

## Pliki (scope)

- `packages/mcp/src/tools.ts`, `packages/mcp/src/server.ts`, `packages/mcp/__tests__/**`
- `packages/cli/agent/PLAYBOOK.md`, `packages/cli/__tests__/playbook-coverage.test.ts`

## Weryfikacja

```bash
npm run verify
npm run agent-eval
```

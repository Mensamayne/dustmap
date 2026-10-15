# DUST-17 — Agent wpięty w Dustmap: playbook + `init --agent`

**Queue:** `DUST-17` | **Epic:** DUST | **Segment:** agent | **Layer:** 17

## Overview

Agent AI w cudzym repo (Claude Code, Cursor, Codex) po jednej komendzie wie, że Dustmap istnieje, jak go wołać i jak z niego korzystać od początku do końca: podsumowanie → wybór miejsca → dowód → sprawdzenie bezpieczeństwa → decyzja albo zadanie do kolejki. Bez czytania dokumentacji przez człowieka.

## Plan

### Step 1 — Playbook (jedno źródło)

- **Plik:** `packages/cli/agent/PLAYBOOK.md`
- **Zmiana:** pętla agenta krok po kroku z nazwami narzędzi MCP i odpowiednikami CLI; zasady: nie usuwaj bez uruchomienia `verifyHint`; nie decyduj `keep` bez powodu; raport nieaktualny → najpierw `scan --diff`; jak streścić wynik człowiekowi (miejsca i skutki, nie lista fingerprintów); kiedy `enqueue`, a kiedy tylko pokazać.
- **Done when:** każde narzędzie MCP i komenda CLI z DUST-10/11 występuje w playbooku (test porównuje listy).

### Step 2 — `dustmap init --agent <claude|cursor|codex|all>`

- **Plik:** `packages/cli/src/init-agent.ts`
- **Zmiana:** z playbooka generuje: skill `.claude/skills/dustmap/SKILL.md`, regułę `.cursor/rules/dustmap.mdc`, sekcję w `AGENTS.md` (między znacznikami `<!-- dustmap:begin/end -->`, reszta pliku nietknięta), wpis serwera MCP (`.mcp.json` / `.cursor/mcp.json`). Pliki istniejące: tylko podmiana bloku między znacznikami, nigdy nadpisanie całości. `--dry` pokazuje różnice.
- **Done when:** test: `AGENTS.md` z własną treścią → po `init --agent` treść użytkownika bajt w bajt ta sama; drugi przebieg = zero zmian.

### Step 3 — Samodzielne wdrożenie agenta przez MCP

- **Plik:** `packages/mcp/src/tools.ts`
- **Zmiana:** narzędzie `dustmap_guide` zwraca skrót playbooka (≤ 4 KiB); każda odpowiedź narzędzi ma pole `next` z 1–3 sugerowanymi kolejnymi wywołaniami.
- **Done when:** test: z samego `dustmap_guide` + pól `next` da się przejść całą pętlę na fixture.

## Constraints

- `init --agent` to jedyny zapis poza `.dustmap/` i configiem — wyłącznie na jawne polecenie, wyłącznie bloki między znacznikami
- Playbook bez wiedzy o konkretnym projekcie

## Pliki (scope)

- `packages/cli/agent/**`, `packages/cli/src/init-agent.ts`, `packages/cli/__tests__/**`
- `packages/mcp/src/tools.ts`, `packages/mcp/__tests__/**`
- `packages/cli/README.md`

## Weryfikacja

```bash
npm run verify
```

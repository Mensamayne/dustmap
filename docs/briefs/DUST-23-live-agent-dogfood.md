# DUST-23 — Żywy agent na migawce Monorepo-A (dokończenie DUST-18)

**Queue:** `DUST-23` | **Epic:** DUST | **Segment:** agent | **Layer:** 23

## Overview

Dowód, którego DUST-18 nie dał: prawdziwy Claude Code (`claude -p`) z serwerem MCP Dustmap przechodzi 8 zadań z `tools/agent-eval/tasks.json` na migawce Monorepo-A. Wynik: tabela zadanie → sukces / porażka / ile wywołań / koszt / co poszło nie tak; każda usterka narzędzia = nowy brief.

## Przed startem (maintainer)

`claude auth status` musi pokazać `loggedIn: true` (albo ustawiony `ANTHROPIC_API_KEY`). Harness sprawdza to sam i bez logowania kończy się jednym czytelnym błędem (BUG-05). Koszt: limit 0,5 USD na zadanie, maks. ~4 USD.

## Plan

### Step 1 — Przebieg

- **Plik:** `docs/experiments/agent-dogfood.md`
- **Zmiana:** `npm run agent-eval:live`; tabela z `.tmp/agent-eval/results.json` (narzędzia, liczba wywołań, koszt, odpowiedź w jednym zdaniu)
- **Done when:** wszystkie 8 zadań w tabeli; każda porażka ma przyczynę

### Step 2 — Usterki do kolejki

- **Plik:** `docs/briefs/queue.json` + nowe briefy
- **Zmiana:** każda usterka narzędzia = brief (`_TEMPLATE.md` / `_BUG_TEMPLATE.md`). Spodziewany kandydat: T08 — MCP nie ma narzędzia do kolejki (`dustmap-briefs enqueue` tylko z CLI)
- **Done when:** `queue:validate` zielone

## Constraints

- Zakaz poprawiania narzędzia w tym briefie — tylko pomiar i zgłoszenia
- Transkrypty tylko w `.tmp/agent-eval/` (nie commitować)

## Pliki (scope)

- `docs/experiments/agent-dogfood.md`, `docs/briefs/**`

## Weryfikacja

```bash
npm run agent-eval:live
npm run queue:validate
```

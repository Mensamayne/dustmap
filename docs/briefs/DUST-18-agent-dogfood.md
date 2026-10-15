# DUST-18 — Próba agenta na Monorepo-A (dogfood)

**Queue:** `DUST-18` | **Epic:** DUST | **Segment:** agent | **Layer:** 18

## Overview

Dowód, że agent naprawdę umie z Dustmapa korzystać na dużym, prawdziwym repo — nie tylko na fixtures. Zestaw zadań dla agenta na migawce Monorepo-A, każde z mierzalnym warunkiem sukcesu. Wynik to raport: co agent zrobił dobrze, gdzie się pogubił, które odpowiedzi narzędzi były za długie albo niejasne. Usterki stają się briefami.

## Read first

1. [docs/TEST-TARGETS.md](../TEST-TARGETS.md)
2. `packages/cli/agent/PLAYBOOK.md` (DUST-17)

## Plan

### Step 1 — Zadania i warunki (skryptowane)

- **Plik:** `tools/agent-eval/tasks.json`, `tools/agent-eval/run.mjs`
- **Zmiana:** min. 8 zadań, np.: „pokaż 3 najbezpieczniejsze usunięcia”, „dlaczego miejsce nr 1 jest na górze”, „czy raport jest aktualny”, „oznacz to znalezisko jako celowe z powodem”, „zamień 2 znaleziska w zadania do kolejki”. Każde: maks. liczba wywołań narzędzi, wymagane narzędzia, oczekiwane pola w odpowiedzi. Runner odtwarza wzorcowe sekwencje wywołań przez klienta MCP in-process na migawce `monorepo-a` i sprawdza: limity rozmiaru, obecność `next`, wykrycie nieaktualności, zapis decyzji tylko do `.dustmap/` w `outputDir`.
- **Done when:** `npm run agent-eval` zielone; test negatywny: odpowiedź ponad limit → czerwone.

### Step 2 — Przebieg z prawdziwym agentem

- **Plik:** `docs/experiments/agent-dogfood.md`
- **Zmiana:** Claude Code w trybie bez interfejsu (`claude -p`) z serwerem MCP Dustmap, katalog roboczy = migawka Monorepo-A w `.tmp/`; te same zadania z `tasks.json` jako prośby. Zapis: transkrypt do `.tmp/agent-eval/`, w raporcie tabela zadanie → sukces / porażka / ile wywołań / co poszło nie tak.
- **Done when:** raport z wszystkimi zadaniami; każda porażka ma przyczynę i ID nowego briefu albo wyjaśnienie, dlaczego to nie wina narzędzia.

### Step 3 — Usterki do kolejki

- **Plik:** `docs/briefs/queue.json` + nowe briefy
- **Zmiana:** każda usterka narzędzia z kroku 2 = brief (`kind: bug` albo `feature`), zgodnie z `_TEMPLATE.md` / `_BUG_TEMPLATE.md`.
- **Done when:** `queue:validate` zielone.

## Constraints

- Agent pracuje na migawce w `.tmp/`, nigdy w `../monorepo-a`
- Zakaz poprawiania narzędzia w tym briefie — tylko pomiar i zgłoszenia
- Transkrypty tylko w `.tmp/` (nie commitować)

## Pliki (scope)

- `tools/agent-eval/**`, `docs/experiments/agent-dogfood.md`, `docs/briefs/**`, `package.json`

## Weryfikacja

```bash
npm run verify
npm run agent-eval
```

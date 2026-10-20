# BUG-03 — Skan „tylko zmian” kasuje całą mapę; odświeżenie bierze złą bazę

**Queue:** `BUG-03` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** high | **Epik:** BUG

**Źródło:** audyt epiku DUST 2026-10-20 (skan tego repo: `full` = 216 znalezisk → `scan --diff HEAD~1` w ten sam `outputDir` = 8)

## Overview

Naprawić bug: skan w trybie `diff` nadpisuje `report.json` samymi znaleziskami z dotkniętych plików. Playbook i pola `next` każą agentowi robić `dustmap_scan` (diff) po decyzji i przy nieaktualnym raporcie — więc agent traci mapę całego repo, a `summary` mówi „raport aktualny”. Do tego odświeżenie domyślnie porównuje z `HEAD~1`, a nie z commitem raportu: gdy raport jest 10 commitów za `HEAD`, 9 z nich nigdy nie trafia do skanu.

## Decyzja maintainera (2026-10-20): wariant B

`diff` zapisuje **osobny** raport `report.diff.json`; `report.json` to zawsze pełna mapa i zmienia go tylko skan `full`. Każde narzędzie czytające raport wybiera plik jawnie (`--report full|diff`, MCP `report`), domyślnie pełny.

## Plan

### Step 1 — Dwa pliki raportu w rdzeniu

- **Plik:** `packages/core/src/scan/report-file.ts`, `packages/core/src/scan/run-scan.ts`, `packages/core/src/index.ts`
- **Zmiana:** nazwa pliku z trybu skanu; jeden loader z czytelnym błędem, używany przez CLI, MCP i wtyczkę briefów (zero kopii)
- **Done when:** test: `full` → `diff` w tym samym `outputDir` → `report.json` bajt w bajt ten sam, `report.diff.json` ma `mode: diff`

### Step 2 — Odświeżenie od commitu raportu (MCP)

- **Plik:** `packages/mcp/src/tools.ts`, `packages/mcp/src/server.ts`, `packages/mcp/src/report-io.ts`
- **Zmiana:** `dustmap_scan` diff bez `baseRef` bierze commit pełnego raportu (bez raportu: `HEAD~1`); narzędzia czytające mają `report: full|diff`; nieaktualna mapa → `next` = skan `full`; po skanie diff → `dustmap_list` z `report: diff`
- **Done when:** test: raport 2 commity za HEAD → diff obejmuje pliki z obu commitów, pełny raport nietknięty

### Step 3 — CLI, akcja GitHuba, briefy

- **Plik:** `packages/cli/src/**`, `packages/cli/action/**`, `packages/cli/README.md`, `packages/sink-briefs/src/**`
- **Zmiana:** `summary|list|show|export|ratchet --report full|diff`; akcja eksportuje SARIF i liczy zapadkę z raportu diff; `dustmap-briefs enqueue --report diff`
- **Done when:** test e2e: `scan` → `scan --diff` → `summary` pokazuje pełną liczbę; `list --report diff` i `export --report diff` działają

### Step 4 — Opis dla agenta

- **Plik:** `packages/cli/agent/PLAYBOOK.md`
- **Zmiana:** mapa (`full`) vs przegląd zmian (`diff`); nieaktualna mapa → skan `full`
- **Done when:** playbook coverage test zielony (w tym limit 4 KiB)

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Report-only bez zmian: zapis tylko pod `outputDir`
- Kontrakt raportu bez zmian (tryb już jest w `scan.mode`)

## Pliki (zamknięta lista)

- `packages/core/src/scan/**`, `packages/core/src/index.ts`
- `packages/mcp/src/**`, `packages/mcp/__tests__/**`
- `packages/cli/src/**`, `packages/cli/__tests__/**`, `packages/cli/action/**`, `packages/cli/README.md`, `packages/cli/agent/PLAYBOOK.md`
- `packages/sink-briefs/src/**`, `packages/sink-briefs/__tests__/**`
- `README.md`, `docs/INTEGRATION-QUEUE.md`, `docs/briefs/queue.json`

## Weryfikacja

```bash
npm run verify
npm run agent-eval
```

## Po zakończeniu

1. Commit `Fixes BUG-03: …`
2. `node tools/queue/close.mjs --id BUG-03 --note "…"` + liczby: full vs full→diff na tym repo

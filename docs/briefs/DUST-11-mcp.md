# DUST-11 — Serwer MCP

**Queue:** `DUST-11` | **Epic:** DUST | **Segment:** core | **Layer:** 11

## Overview

Agent AI (Claude Code, Cursor, dowolny klient MCP) czyta raport bez konfiguracji: najpierw krótkie podsumowanie, potem szczegół jednego znaleziska, na końcu zapis decyzji. Agent nie dostaje ściany JSON.

## Plan

### Step 1 — Narzędzia

- **Plik:** `packages/mcp/src/tools.ts`
- **Zmiana:** `dustmap_summary` (top miejsca + liczniki, wiek raportu vs `HEAD`), `dustmap_list` (filtr kategoria/ścieżka, stronicowanie), `dustmap_show` (pełny dowód + `verifyHint`), `dustmap_decide` (zapis do `decisions.yml`), `dustmap_scan` (opcjonalnie, `diff` domyślnie).
- **Done when:** test klienta MCP in-process woła każde narzędzie na fixture.

### Step 2 — Limit odpowiedzi i świeżość

- **Plik:** `packages/mcp/src/limits.ts`
- **Zmiana:** twardy limit rozmiaru odpowiedzi (config, domyślnie 32 KiB) z jawnym „obcięto, użyj stronicowania”; gdy commit raportu ≠ `HEAD`, każda odpowiedź mówi, że raport jest nieaktualny.
- **Done when:** test: duży raport nie przekracza limitu; stary raport ma ostrzeżenie.

## Constraints

- `dustmap_decide` to jedyny zapis i tylko do `.dustmap/decisions.yml`
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/mcp/**`
- `package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

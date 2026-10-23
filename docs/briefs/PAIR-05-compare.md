# PAIR-05 — Porównanie Monorepo-A + werdykt

**Queue:** `PAIR-05` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 5

## Overview

Ta sama migawka Monorepo-A: EMB-15 vs paczka PAIR. Tabela w emb-results i jedno zdanie: czy PAIR zostaje nowym domyślnym prywatnym.

## Plan

### Step 1 — Skany + złoto

- **Plik:** `docs/experiments/emb-results.md`, `docs/briefs/PAIR-00-overview.md`
- **Zmiana:** `emb:eval` / `emb:pair-eval` + skan CLI na `dbe35aa00cd6`; liczba semantic-duplicate; werdykt
- **Done when:** sekcja PAIR-05 w emb-results; overview PAIR z wynikiem epiku

## Constraints

- Cele tylko do odczytu; output w `.tmp/`
- Zakaz strojenia pod wynik skanu Monorepo-A po faktach

## Pliki (scope)

- `docs/experiments/emb-results.md`, `docs/briefs/PAIR-00-overview.md`, ewentualnie `tools/targets/*pair*.dustmap.config.json`

## Weryfikacja

```bash
npm run emb:pair-eval -- --model dustmap-same-meaning-private-pair --calibrated
# skan porównawczy jak CON-11
```

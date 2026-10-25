# DUP-06 — Raport i MCP: grupy z warstwą, dowodem i szkicem

**Queue:** `DUP-06` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 4

## Overview

Agent widzi jedną grupę na jeden powielony koncept: członkowie, warstwa, która ją znalazła (L1–L4), dowody (mapa nazw, diff, typy CSS, ocena sędziego), kierunek kopii i szkic. Duplikaty tego samego miejsca z kilku warstw (jscpd, L1, semantyka) łączą się w jedną grupę.

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Łączenie warstw

- **Plik:** `packages/core/src/scan/**`, `packages/core/src/semantic/dedupe-vs-clones.ts`
- **Zmiana:** jedna grupa na zbiór miejsc; najmocniejsza warstwa decyduje o pewności
- **Done when:** brak podwójnych zgłoszeń tego samego miejsca

### Step 2 — MCP i CLI

- **Plik:** `packages/mcp/**`, `packages/cli/**`
- **Zmiana:** pola grupy w odpowiedziach; playbook dla agenta
- **Done when:** agent kończy pętlę bez czytania dokumentacji (test e2e)

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `packages/core/src/scan/**`
- `packages/core/src/semantic/**`
- `packages/mcp/**`
- `packages/cli/**`
- `packages/contract/**`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Jedna grupa na koncept
- [ ] Agent kończy pętlę (e2e)

## Po zakończeniu

1. Commit `Fixes DUP-06: …`
2. `node tools/queue/close.mjs --id DUP-06 --note "…"`

# BUG-10 — „Nieużywana zależność” z wysoką pewnością, gdy paczki nie są zainstalowane

**Queue:** `BUG-10` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** medium | **Epik:** BUG

**Źródło:** lab `06-pulapki-frameworka` 2026-10-20 (`next` z `"dev": "next dev"` → `unused-dependency` high)

## Overview

Naprawić bug: bez `node_modules` Knip nie umie przypisać polecenia ze skryptu (`next dev`) do paczki, więc zgłasza ją jako nieużywaną. Dustmap daje temu `high`, bo liczy wzmianki nazwy tylko w kodzie, nie w `package.json`. Dokładnie tak wyglądają skany kopii z `git archive` (cele DUST-16, poligon) i świeże klony w CI przed `npm install`. Z zainstalowanymi paczkami fałszywy alarm znika (sprawdzone w labie).

## Read first

1. `packages/core/src/adapters/knip/normalize.ts` — `confidenceForMentions`, `mentionTexts`
2. `packages/core/src/adapters/knip/run.ts` — wywołanie Knip

## Plan

### Step 1 — fix at source

- **Plik:** `packages/core/src/adapters/knip/**`
- **Zmiana:** gdy zależności nie są zainstalowane (brak `node_modules` paczki obok jej `package.json`), znaleziska `unused-dependency` / `unlisted-dependency` mają najwyżej `low` i dowód „zależności niezainstalowane — nie da się sprawdzić skryptów”; wzmianki nazwy liczone także w `scripts` z `package.json`
- **Done when:** repo Next bez `node_modules` → `next` najwyżej `low`; z `node_modules` zachowanie bez zmian

### Step 2 — regression guard

- **Plik:** `packages/core/__tests__/knip-false-positives.test.ts`
- **Zmiana:** fixture bez `node_modules` ze skryptem `next dev`
- **Done when:** test zielony; lab `06` bez 🟡 BUG-10

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Bez listy znanych paczek (`next`, `react`…) — reguła ogólna

## Pliki (zamknięta lista)

- `packages/core/src/adapters/knip/**`
- `packages/core/__tests__/knip-false-positives.test.ts`, `packages/core/fixtures/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Po zakończeniu

1. Commit `Fixes BUG-10: …`
2. `node tools/queue/close.mjs --id BUG-10 --note "…"` + liczba `unused-dependency` high na Monorepo-A przed/po

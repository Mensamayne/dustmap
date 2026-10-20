# BUG-06 — Dane testowe (fixtures) zgłaszane jako martwy kod „high”

**Queue:** `BUG-06` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** medium | **Epik:** BUG

**Źródło:** self-scan Dustmapa 2026-10-20 (13 z 19 „pewnych” martwych plików to `packages/core/fixtures/**`); lab `06-pulapki-frameworka`

## Overview

Naprawić bug: plik z rolą `fixture` (DUST-20) dostaje `unused-file` z pewnością `high`. Dane testowe z założenia nie są importowane — testy czytają je z dysku — więc zawsze wyglądają na martwe. Klasyfikator zna rolę, ale adapter Knip blokuje tylko `generated / vendored / minified / oversized`.

## Read first

1. `packages/core/src/adapters/knip/normalize.ts` — `BLOCKED_ROLES`, `isAllowedFile`
2. `packages/core/src/adapters/knip/run.ts` — budowa `knip.json` (ignore / entry)
3. `../dustmap-lab/scenarios/06-pulapki-frameworka.mjs` — reprodukcja

## Plan

### Step 1 — reproduce and locate

- **Plik:** `packages/core/src/adapters/knip/normalize.ts`
- **Zmiana:** potwierdź, że rola `fixture` przechodzi do znalezisk martwego kodu
- **Done when:** root cause w notatce close

### Step 2 — fix at source

- **Plik:** `packages/core/src/adapters/knip/normalize.ts`, `packages/core/src/adapters/knip/run.ts`
- **Zmiana:** pliki `fixture` nie dostają znalezisk martwego kodu (ogólna reguła roli, zero list ścieżek)
- **Done when:** self-scan: 0 znalezisk dead-code w `packages/core/fixtures/**`

### Step 3 — regression guard

- **Plik:** `packages/core/__tests__/knip-false-positives.test.ts`
- **Zmiana:** katalog `fixtures/` z nieimportowaną „przykładową aplikacją” → zero znalezisk dead-code
- **Done when:** test zielony; lab `06` bez 🟡 BUG-06

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Bez list wyjątków pod konkretne repo — tylko rola pliku

## Pliki (zamknięta lista)

- `packages/core/src/adapters/knip/**`
- `packages/core/__tests__/knip-false-positives.test.ts`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Plus `node run-lab.mjs 06` w `../dustmap-lab`.

## Po zakończeniu

1. Commit `Fixes BUG-06: …`
2. `node tools/queue/close.mjs --id BUG-06 --note "…"` + liczba dead-code high w self-scanie przed/po

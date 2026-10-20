# BUG-12 — W monorepo punkty wejścia nie docierają do paczek: testy „martwe” z pewnością high

**Queue:** `BUG-12` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** high | **Epik:** BUG

**Źródło:** poligon 2026-10-20 (Dustmap na sobie po `init`: 20 plików testów jako `unused-file` high); lab `10-monorepo-init`

## Overview

Naprawić bug: `buildKnipConfig` wpisuje punkty wejścia (z configu użytkownika i pliki z rolą `test`) do konfiguracji Knip **głównego** katalogu. W repo z workspaces Knip ocenia każdą paczkę osobno, więc wpisy wskazujące pliki w `packages/*` przepadają. Paczki zostają na wtyczkach Knip (np. Vitest), a te bez zainstalowanych zależności nie wczytują `vitest.config.ts` — testy wychodzą na martwe. Ten sam mechanizm może gubić punkty wejścia użytkownika w paczkach (sprawdzić na Monorepo-A).

## Read first

1. `packages/core/src/adapters/knip/run.ts` — `buildKnipConfig` (`entry`, `project`, `ignore` tylko na poziomie głównym)
2. `../dustmap-lab/scenarios/10-monorepo-init.mjs` — reprodukcja (2 paczki, `vitest.config.ts`, bez `node_modules`)
3. `packages/core/src/init/detect.ts` — wykrywanie workspaces (BUG-01)

## Plan

### Step 1 — reproduce and locate

- **Plik:** `packages/core/src/adapters/knip/run.ts`
- **Zmiana:** potwierdź na wygenerowanym `knip.json`, że wpisy z `packages/*` nie trafiają do workspace'ów
- **Done when:** root cause w notatce close; lista wpisów użytkownika Monorepo-A, które dziś przepadają

### Step 2 — fix at source

- **Plik:** `packages/core/src/adapters/knip/run.ts`
- **Zmiana:** każdy punkt wejścia (plik i glob) przypisany do swojej paczki → `workspaces: { "<paczka>": { entry, project } }` ze ścieżkami względnymi do paczki; główny katalog dostaje tylko swoje
- **Done when:** lab `10` bez 🟡 BUG-12; self-scan po `init`: 0 testów jako martwe

### Step 3 — regression guard

- **Plik:** `packages/core/__tests__/knip-false-positives.test.ts`, `packages/core/fixtures/**`
- **Zmiana:** fixture monorepo: testy z `vitest.config.ts` w paczce + punkt wejścia użytkownika w paczce, bez `node_modules`
- **Done when:** test zielony

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`; zakaz „wycinania testów z raportu” zamiast naprawy przypisania
- Bez wiedzy o konkretnym repo

## Pliki (zamknięta lista)

- `packages/core/src/adapters/knip/**`, `packages/core/src/init/detect.ts` (lista paczek workspace, także pnpm)
- `packages/core/__tests__/knip-false-positives.test.ts`, `packages/core/fixtures/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Plus `node run-lab.mjs 10` i `node run-poligon.mjs dustmap` w `../dustmap-lab`.

## Po zakończeniu

1. Commit `Fixes BUG-12: …`
2. `node tools/queue/close.mjs --id BUG-12 --note "…"` + dead-code high przed/po: self po `init`, Monorepo-A

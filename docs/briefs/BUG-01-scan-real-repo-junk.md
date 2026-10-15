# BUG-01 — Skan czyta pliki ignorowane przez git; punkty wejścia wskazują `dist/`

**Queue:** `BUG-01` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** high | **Epik:** BUG

**Źródło:** pomiar na Monorepo-A 15.10.2026 (pusty adapter, tryb full)

## Overview

Na prawdziwym repo skan bierze śmieci z dysku i dlatego jest wolny: Monorepo-A = 32 587 plików zamiast ~10,9 tys. śledzonych (`.tmp/` 14 tys., `.next/` + `.next-dev/` 7 tys.), 96 s na sam odczyt. `init` proponuje punkty wejścia ze zbudowanych plików (`packages/cli/dist/index.js`), które `exclude` i tak wycina — w praktyce zero punktów wejścia dla paczek. Next.js w paczce workspace (`monorepo-a-web`) nie jest wykrywany wcale, bo wykrywanie patrzy tylko na root.

## Read first

1. `packages/core/src/scan/collect-files.ts` — chodzenie po dysku bez `.gitignore`
2. `packages/core/src/init/detect.ts` — `binEntries`, pętla po workspace'ach

## Plan

### Step 1 — Lista plików z gita

- **Plik:** `packages/core/src/scan/collect-files.ts`, `packages/core/src/scan/git.ts`
- **Zmiana:** w repo git: `git ls-files -z --cached --others --exclude-standard` (śledzone + nowe nieignorowane), potem `include`/`exclude`; poza gitem: chodzenie po dysku jak dotąd. Tryb diff: `git diff --name-only --relative` (ścieżki względem skanowanego katalogu, także gdy to podkatalog repo).
- **Done when:** test: pliki w `.tmp/`, `.next/`, ignorowanym logu nie trafiają do skanu; nowy nieśledzony plik trafia.

### Step 2 — Punkty wejścia ze źródeł

- **Plik:** `packages/core/src/init/detect.ts`
- **Zmiana:** każda paczka workspace (glob `x/*` → katalogi, ścieżka dokładna → ona sama) przechodzi to samo wykrywanie co root (Next, Vite, bin, skrypty) z prefiksem ścieżki. Plik wejścia w katalogu wyjścia builda → źródło: `outDir`/`rootDir` z `tsconfig.json` paczki (przez API TypeScript, z `extends`), a gdy brak — konwencja `dist|build|out|lib` → `src`; tylko ścieżki, które istnieją. Nierozwiązane → `unresolvedEntryPoints` z powodem (nie ciche pominięcie).
- **Done when:** fixture: bin `dist/cli.js` + `tsconfig` (`rootDir: src`) → `packages/x/src/cli.ts`; Next w `apps/web` → `apps/web/app/**/page.tsx`; bin bez źródła → w `unresolvedEntryPoints`.

### Step 3 — Test na prawdziwym śmietniku

- **Plik:** `packages/core/src/scan/real-junk.test.ts`
- **Zmiana:** repo git w katalogu tymczasowym odwzorowujące Monorepo-A: `.gitignore` z `.tmp/`, `**/.next/`, `node_modules/`; setki plików śmieci w tych katalogach; workspace z Next i paczka z `dist/`. Sprawdza listę skanowanych plików i wynik `init`.
- **Done when:** test zielony; ten sam test na starym `collectFiles` byłby czerwony.

## Constraints

- Zero zapisu w skanowanym repo (bez zmian względem DUST-02)
- Bez list wyjątków pod konkretne repo — tylko `.gitignore`, `tsconfig` i ogólna konwencja katalogów builda

## Pliki (zamknięta lista)

- `packages/core/src/scan/collect-files.ts`, `packages/core/src/scan/git.ts`, `packages/core/src/config/schema.ts` (domyślny `include` bez `.mts`/`.cts` — wyłapane przez test śmietnika)
- `packages/core/src/init/detect.ts`, `packages/core/src/init/detect.test.ts`, `packages/core/src/index.ts`
- `packages/core/src/scan/real-junk.test.ts`, `packages/core/test/fixtures/**`
- `packages/core/package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

## Po zakończeniu

1. Commit `Fixes BUG-01: …`
2. `node tools/queue/close.mjs --id BUG-01 --note "…"` + liczby z pomiaru Monorepo-A (pliki, czas)

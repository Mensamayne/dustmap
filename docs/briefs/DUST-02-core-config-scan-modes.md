# DUST-02 — Rdzeń: konfiguracja, init, tryby skanu

**Queue:** `DUST-02` | **Epic:** DUST | **Segment:** core | **Layer:** 2

## Overview

Paczka `@dustmap/core` uruchamia skan na dowolnym repo: wczytuje konfigurację, wybiera pliki (całe repo albo tylko zmiany względem gałęzi), odpala zarejestrowane adaptery i składa raport v1. `init` sam rozpoznaje framework i zapisuje, skąd kod jest naprawdę wywoływany.

## Plan

### Step 1 — Konfiguracja

- **Plik:** `packages/core/src/config/`
- **Zmiana:** `dustmap.config.json` (Zod): `include`, `exclude`, `entryPoints[]` (globy plików ładowanych przez framework / skrypty / po nazwie), `layers[]` (dla DUST-08), `adapters` (włącz/wyłącz + opcje), `semantic.provider`, `outputDir` (domyślnie `.dustmap/` w skanowanym repo; może wskazywać katalog **poza** nim — tak testujemy na cudzych repo bez zapisu w nich, [TEST-TARGETS](../TEST-TARGETS.md)). Config może leżeć poza skanowanym repo (`--config <ścieżka>`).
- **Done when:** brak pliku = sensowne domyślne; zły klucz = czytelny błąd z nazwą pola; skan z `outputDir` poza repo nie tworzy w repo żadnego pliku (test).

### Step 2 — `init` z wykrywaniem

- **Plik:** `packages/core/src/init/detect.ts`
- **Zmiana:** wykrywa Next (app/pages router), Vite, Node CLI (`bin` w package.json), workspaces npm/pnpm, Vitest/Jest; dokłada punkty wejścia (np. `app/**/page.tsx`, `route.ts`, skrypty z `package.json`). Nie nadpisuje istniejącego configu.
- **Done when:** 3 repo-fixtures (Next, Vite, monorepo workspaces) dają oczekiwane `entryPoints`.

### Step 3 — Tryby `full` / `diff` + cache

- **Plik:** `packages/core/src/scan/`
- **Zmiana:** `full` = cały `include`; `diff --base <ref>` = pliki z `git diff --name-only <merge-base>` + ich sąsiedzi z grafu importów. Cache w `.dustmap/cache/` kluczowany hashem treści pliku i wersją adaptera.
- **Done when:** drugi `full` bez zmian nie liczy nic od nowa (licznik w meta skanu); `diff` na fixture zwraca tylko dotknięte znaleziska.

### Step 4 — Interfejs adaptera

- **Plik:** `packages/core/src/adapter.ts`
- **Zmiana:** `Adapter { name, version(), run(ctx): Promise<Finding[]> }`; błąd adaptera = wpis w `scan.tools[].error`, reszta skanu idzie dalej (nie ciche połknięcie).
- **Done when:** test z fałszywym adapterem, który rzuca → raport ma błąd + znaleziska pozostałych.

## Constraints

- Rdzeń zapisuje **wyłącznie** pod `outputDir` (domyślnie `.dustmap/`); `init` dodatkowo tworzy config, gdy go nie ma
- Ścieżki POSIX także na Windows
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/**`
- `package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

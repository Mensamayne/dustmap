# DUST-20 — Rola każdego pliku: co jest naprawdę kodem

**Queue:** `DUST-20` | **Epic:** DUST | **Segment:** core | **Layer:** 20

## Overview

Każdy skanowany plik dostaje rolę: kod źródłowy, test, dane testowe, deklaracje typów, plik generowany, cudza biblioteka, zminifikowana paczka albo plik za duży na analizę. Wykrywacze dostają role i domyślnie pracują na kodzie źródłowym — nie mielą paczek po 2 MB ani skopiowanych bibliotek. Pomiar na Monorepo-A (15.10.2026): 29% plików to testy, a 54 pliki generowane / zminifikowane / cudze ważą 10 MB, czyli ~19% bajtów skanu.

## Plan

### Step 1 — Kontrakt

- **Plik:** `packages/contract/src/report.ts`, `packages/contract/src/file-role.ts`
- **Zmiana:** `FileRole` = `source | test | fixture | declaration | generated | vendored | minified | oversized`; `scan.files = { total, byRole }` (opcjonalne w v1).
- **Done when:** parse round-trip; nieznana rola pada.

### Step 2 — Klasyfikator (ogólne reguły, bez list pod konkretne repo)

- **Plik:** `packages/core/src/scan/classify.ts`
- **Zmiana:** kolejność: (1) atrybuty git `linguist-generated` / `linguist-vendored` / `linguist-documentation` z `.gitattributes` — jedno wywołanie `git check-attr --stdin` na cały skan; (2) globy z configu `classify.{generated,vendored,test,fixture}`; (3) ścieżka: `.d.ts`, katalogi i sufiksy testów, katalogi danych testowych, `vendor/`, `third_party/`, `*.min.*`; (4) rozmiar > `classify.maxFileBytes` (domyślnie 300 KB) → `oversized` bez czytania treści; (5) treść: nagłówek „generated / do not edit” w pierwszych 600 znakach → `generated`; najdłuższa linia > 2000 znaków albo średnio > 250 znaków na linię → `minified`. Każda rola ma powód (`reason`).
- **Done when:** testy na każdą regułę + atrybut git nadpisuje heurystykę.

### Step 3 — Wpięcie w skan

- **Plik:** `packages/core/src/scan/run-scan.ts`, `packages/core/src/adapter.ts`
- **Zmiana:** `AdapterContext.roles` (mapa plik → rola) i `filesWithRole(...roles)`; treść plików `oversized` nie jest wczytywana; raport ma `scan.files`.
- **Done when:** test na repo-śmietniku: zminifikowana paczka, plik generowany, `vendor/`, plik 1 MB, test → właściwe role; `filesWithRole("source")` ich nie zawiera.

## Constraints

- Zero list wyjątków pod konkretne repo — tylko ogólne reguły + `.gitattributes` + config użytkownika
- Wykrywacze (DUST-03…08) domyślnie biorą `source`; testy tylko tam, gdzie są potrzebne (graf importów)

## Pliki (scope)

- `packages/contract/src/**`, `packages/core/src/**`

## Weryfikacja

```bash
npm run verify
```

Notatka zamknięcia: rozkład ról na Monorepo-A i Service-B + czas skanu.

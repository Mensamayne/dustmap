# EMB-08 — Dostawca `onnx` w Dustmapie

**Queue:** `EMB-08` | **Epic:** EMB | **Segment:** semantic | **Layer:** 8

## Overview

Dustmap sam liczy wektory funkcji modelem z EMB-07, sam szuka **wszystkich** par nad progiem (jscpd zwracał tylko część) i grupuje je jak w decyzji DUST-15: kilka par między tymi samymi dwoma plikami = jedno znalezisko „dwa równoległe systemy”, jedna funkcja w N kopiach = jedna grupa z N miejscami. Działa bez sieci, z pamięcią wektorów, więc drugi skan liczy tylko zmienione funkcje.

## Read first

1. `packages/core/src/semantic/provider.ts`, `run.ts`, `cluster.ts`, `vector-cache.ts`, `extract.ts`
2. `docs/experiments/embedding-spike.md` — decyzje 2 i 4

## Plan

### Step 1 — Wycinanie funkcji z drzewa składni

- **Plik:** `packages/core/src/semantic/extract.ts`
- **Zmiana:** kompilator TypeScript (już zależność rdzenia) zamiast heurystyki nawiasów: funkcje, metody, strzałki przypisane do nazw; dokładne linie; nazwa z deklaracji
- **Done when:** test na metodach klas, strzałkach w obiektach i funkcjach zagnieżdżonych

### Step 2 — Dostawca

- **Plik:** `packages/core/src/semantic/onnx-provider.ts`, `packages/core/src/config/schema.ts`, `packages/core/package.json`
- **Zmiana:** `semantic.provider: "onnx"`, `semantic.model` = id paczki modelu z katalogu użytkownika (np. `~/.cache/dustmap/models/<id>`); weryfikacja sum z `manifest.json` przed użyciem; brak modelu = czytelny błąd z komendą pobrania (EMB-11), nigdy ciche pobieranie. Zależność ONNX Runtime + tokenizer — tylko licencje z bramki DUST-12
- **Done when:** test z małym modelem testowym (kilka KB, w `fixtures`) — bez sieci

### Step 3 — Wszystkie pary i grupy

- **Plik:** `packages/core/src/semantic/cluster.ts`, `packages/core/src/semantic/run.ts`
- **Zmiana:** podobieństwo wszystkich par w obrębie języka (dla dużych repo: indeks przybliżony, deterministyczny); grupy po parze plików i po funkcji; dowód: min/max podobieństwa, nazwy, liczba funkcji
- **Done when:** lab `03`: trzy te same pętle = jedna grupa z 3 miejscami

## Constraints

- Report-only bez zmian; zapis tylko pod `outputDir` (cache) i w katalogu modeli przy jawnym pobraniu
- Czeka na BUG-07 (etykiety i odciski stron pary)

## Pliki (scope)

- `packages/core/src/semantic/**`, `packages/core/src/config/schema.ts`, `packages/core/package.json`, `package-lock.json`, `packages/core/__tests__/**`, `packages/core/fixtures/**`, `tools/isolation-denylist.json`

## Weryfikacja

```bash
npm run verify
npm run emb:eval -- --provider onnx --model <id>
```

Plus `node run-lab.mjs 03` w `../dustmap-lab`.

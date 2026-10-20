# BUG-08 — Odcisk martwego kodu z samej nazwy: decyzje nigdy nie wygasają

**Queue:** `BUG-08` | **Kind:** bug | **Warstwa:** 100 | **Segment:** core | **Severity:** high | **Epik:** BUG

**Źródło:** lab `08-decyzje-i-odcisk` 2026-10-20

## Overview

Naprawić bug: znaleziska Knip mają odcisk z `export <nazwa>` (eksport) albo `file:<ścieżka>` (plik), a nie z treści kodu. Kontrakt (DUST-01, krok 3) i DUST-09 mówią: zmiana treści = nowy odcisk, więc wyciszone znalezisko wraca. Dziś `keep` na martwym eksporcie jest wieczne — można przepisać całą funkcję i Dustmap dalej milczy. Przesunięcie kodu nadal ma dawać ten sam odcisk.

## Read first

1. `packages/core/src/adapters/knip/normalize.ts` — `snippet` i `fingerprint(kind, [snippet], …)`
2. `packages/contract/src/fingerprint.ts` — normalizacja (bez białych znaków, komentarzy, numerów linii)

## Plan

### Step 1 — fix at source

- **Plik:** `packages/core/src/adapters/knip/normalize.ts` (+ odczyt treści przez `AdapterContext.readFile`)
- **Zmiana:** eksport / typ → treść deklaracji symbolu; plik → treść pliku; zależność zostaje `dep:<nazwa>` (nie ma treści). Treść przez normalizację kontraktu
- **Done when:** zmiana ciała funkcji = nowy odcisk; przesunięcie o 10 linii = ten sam

### Step 2 — regression guard

- **Plik:** `packages/core/__tests__/**`
- **Zmiana:** test: decyzja `keep` → przesunięcie (dalej wyciszone) → zmiana treści (wraca)
- **Done when:** test zielony; lab `08` bez 🟡 BUG-08

## Constraints

- **Anty-maskowanie:** zakaz `.skip`, `.only`, `it.todo`
- Odciski martwego kodu zmienią się raz dla wszystkich: notatka close i README mówią, że decyzje / baseline dla dead-code trzeba odświeżyć (`dustmap ratchet --update-baseline`)

## Pliki (zamknięta lista)

- `packages/core/src/adapters/knip/**`
- `packages/core/__tests__/**` (tylko test tego buga)
- `packages/cli/README.md` (uwaga o jednorazowej zmianie odcisków)

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Po zakończeniu

1. Commit `Fixes BUG-08: …`
2. `node tools/queue/close.mjs --id BUG-08 --note "…"`

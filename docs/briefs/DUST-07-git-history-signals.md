# DUST-07 — Sygnały z historii git

**Queue:** `DUST-07` | **Epic:** DUST | **Segment:** core | **Layer:** 7

## Overview

Raport łączy kod z jego historią: **gorące miejsca** (zawiłe i zmieniane co chwilę), **pliki zawsze zmieniane razem** (jedna rzecz rozbita na dwie), **dużo poprawek w jednym miejscu** (kruchy kod). To najmocniejsze sygnały, gdzie przebudowa się opłaca.

## Plan

### Step 1 — Odczyt historii

- **Plik:** `packages/core/src/signals/git/log.ts`
- **Zmiana:** jeden przebieg `git log --numstat` z oknem czasu (config, domyślnie 6 miesięcy); pomija commity scalające i masowe (> N plików, config) — inaczej formatowanie całego repo zaśmieca współzmiany. Obsługa zmian nazw (`--follow` per plik nie — mapa rename z `-M`).
- **Done when:** repo-fixture budowane w teście (`git init` w temp) daje oczekiwane liczniki.

### Step 2 — Trzy sygnały

- **Plik:** `packages/core/src/signals/git/signals.ts`
- **Zmiana:** `hotspot` = liczba zmian × zawiłość z DUST-06; `co-change` = para plików z wsparciem ≥ N commitów i pewnością ≥ X%; `fix-density` = udział commitów pasujących do wzorca poprawki (config, domyślnie `fix|bug|hotfix` + prefiks Conventional Commits).
- **Done when:** fixture: plik A+B w 8/10 commitów → `co-change` z „80% wspólnych zmian” w `evidence`.

### Step 3 — Tryb `diff`

- **Plik:** `packages/core/src/signals/git/diff-mode.ts`
- **Zmiana:** w `diff` sygnały liczone tylko dla dotkniętych plików, historia z cache.
- **Done when:** test czasu: drugi skan `diff` nie czyta ponownie całego logu.

## Constraints

- Tylko odczyt git — żadnych operacji zapisu w repo
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/signals/git/**`
- `packages/core/__tests__/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

# DUST-09 — Ranking miejsc, decyzje, zapadka

**Queue:** `DUST-09` | **Epic:** DUST | **Segment:** core | **Layer:** 9

## Overview

Zamiast setek pojedynczych ostrzeżeń raport ma na górze ~10 miejsc, gdzie nakłada się kilka sygnałów naraz. Decyzje ludzi („zostaw, bo…”) wyciszają znalezisko na stałe. Zapadka blokuje tylko **nowe** śmieci, stare nie.

## Plan

### Step 1 — Ranking

- **Plik:** `packages/core/src/rank/score.ts`
- **Zmiana:** miejsce = plik (oraz symbol, gdy jest); wynik = suma wag kategorii × `confidence`, premia za różne *rodzaje* sygnałów w tym samym miejscu. Wagi w configu. `summary.topPlaces` = top N z listą sygnałów.
- **Done when:** fixture: plik z hotspotem + klastrem + cyklem wyprzedza plik z pięcioma sygnałami tej samej kategorii.

### Step 2 — Plik decyzji

- **Plik:** `packages/core/src/decisions/store.ts`
- **Zmiana:** `.dustmap/decisions.yml` (kontrakt DUST-01); `keep`/`wontfix` wycina znalezisko z rankingu i liczników; znalezisko, którego kod się zmienił (nowy fingerprint), wraca.
- **Done when:** test: decyzja `keep` → brak w raporcie; zmiana treści → znowu jest.

### Step 3 — Baseline i zapadka

- **Plik:** `packages/core/src/ratchet/`
- **Zmiana:** `baseline.json` = zbiór fingerprintów; `ratchet` zwraca listę **nowych** znalezisk powyżej progu `confidence` (config) i kod wyjścia 1, gdy niepusta. Aktualizacja baseline tylko jawną komendą.
- **Done when:** test: stare znalezisko = 0, nowe = 1.

## Constraints

- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/rank/**`, `src/decisions/**`, `src/ratchet/**`
- `packages/core/__tests__/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

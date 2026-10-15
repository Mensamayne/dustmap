# DUST-08 — Sygnały struktury (graf importów)

**Queue:** `DUST-08` | **Epic:** DUST | **Segment:** core | **Layer:** 8

## Overview

Raport pokazuje moduły, od których zależy pół repo (albo które same importują pół repo), cykle importów i łamanie warstw zadeklarowanych przez użytkownika (np. „UI nie sięga do bazy”).

## Plan

### Step 1 — Adapter dependency-cruiser

- **Plik:** `packages/core/src/adapters/depcruise/run.ts`
- **Zmiana:** dependency-cruiser jako zależność, wyjście JSON; graf modułów dostępny też dla DUST-02 (`diff` → sąsiedzi) i DUST-09.
- **Done when:** fixture z cyklem A→B→C→A → wykryty.

### Step 2 — Sygnały

- **Plik:** `packages/core/src/signals/structure/signals.ts`
- **Zmiana:** `cycle` (cała pętla jako lokacje), `high-fan-in` / `high-fan-out` (progi względne: górne X% repo, nie stała liczba), `layer-violation` z reguł `layers[]` w configu (`{ name, paths, mayImport[] }`).
- **Done when:** fixture z warstwą `ui` importującą `db` → `layer-violation` z oboma plikami w `evidence`.

## Constraints

- Brak domyślnych reguł warstw — tylko te, które użytkownik zadeklaruje
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/adapters/depcruise/**`
- `packages/core/src/signals/structure/**`
- `packages/core/__tests__/**`, `fixtures/**`
- `packages/core/package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

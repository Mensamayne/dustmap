# DUST-04 — Adapter jscpd (kopiuj-wklej)

**Queue:** `DUST-04` | **Epic:** DUST | **Segment:** core | **Layer:** 4

## Overview

Raport grupuje fragmenty skopiowane dosłownie (po tokenach) w klastry: „ten blok występuje w 4 miejscach”, zamiast setek par.

## Plan

### Step 1 — Uruchomienie jscpd (tryb tokenowy)

- **Plik:** `packages/core/src/adapters/jscpd/run.ts`
- **Zmiana:** jscpd jako zależność, reporter JSON, progi `minTokens` / `minLines` z configu; pliki z `include`/`exclude`.
- **Done when:** fixture z blokiem w 3 plikach → wykryty.

### Step 2 — Pary → klastry

- **Plik:** `packages/core/src/adapters/jscpd/cluster.ts`
- **Zmiana:** union-find po parach nakładających się fragmentów → `clone-cluster` (`category: duplicate`), `evidence`: liczba miejsc, łączna liczba wierszy. Fingerprint z znormalizowanej treści, nie ze ścieżek.
- **Done when:** A≈B, B≈C → jeden klaster z 3 lokacjami.

### Step 3 — Szum

- **Plik:** `packages/core/src/adapters/jscpd/noise.ts`
- **Zmiana:** domyślnie pomija pliki testów, fixtures, wygenerowane (`*.gen.*`, nagłówek „generated”) — konfigurowalne. Klastry w samych schematach Zod / importach dostają `confidence: low`.
- **Done when:** test: blok samych importów nie daje `high`.

## Constraints

- Pliki wejściowe z ról (DUST-20): domyślnie `filesWithRole("source")`; nigdy `generated` / `vendored` / `minified` / `oversized`
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/adapters/jscpd/**`
- `packages/core/__tests__/**`
- `packages/core/fixtures/**`
- `packages/core/package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

# V1-02 — Sędzia także na L1-kształt i L2

**Queue:** `V1-02` | **Epic:** V1 | **Segment:** duplicates | **Layer:** 2

## Overview

Kopie „ten sam kod, inne stałe” (L1-kształt) i prawie kopie (L2) dostają werdykt sędziego: potwierdzone idą wyżej, odrzucone niżej, z powodem. Na złocie L1-kształt + L2 po sędzi: precyzja 0,97 (bez sędziego 0,74).

## Plan

### Step 1 — Etap sędziego po scaleniu warstw

- **Plik:** `packages/core/src/scan/**`
- **Zmiana:** grupy `exact-clone` (medium) i `near-clone`: pary prowadzący ↔ każdy członek z tekstu jednostek (ta sama droga co skan: bez komentarzy, końce linii LF); wszystkie potwierdzone → high, wszystkie odrzucone → low; `judgement` + dowód; limit par wspólny ze skanem
- **Done when:** testy z nagranym sędzią; Monorepo-A: liczby i przegląd 20 grup

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Kod poza komputer tylko po jawnym `allowRemote: true`; klucze API tylko ze zmiennych środowiskowych, nigdy z konfiguracji ani raportu
- GPU: ≤ 8 GB i ≤ wolne − 0,5 GB wg nvidia-smi
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `packages/core/src/scan/**`, `packages/core/src/judge/**`, `packages/core/__tests__/**`
- `docs/experiments/dup-results.md`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Werdykt sędziego na L1-kształt i L2
- [ ] Przegląd na Monorepo-A zapisany

## Po zakończeniu

1. Commit `Fixes V1-02: …`
2. `node tools/queue/close.mjs --id V1-02 --note "…"`

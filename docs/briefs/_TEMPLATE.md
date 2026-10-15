# {ID} — {tytuł}

**Queue:** `{ID}` | **Epic:** {EPIC} | **Segment:** {segment} | **Layer:** {N}

## Overview

Jedno–trzy zdania: co ma działać po tym briefie (efekt dla użytkownika narzędzia albo agenta — nie lista plików).

## Read first

Opcjonalnie — max 5 punktów do przeczytania przed kodem:

1. `packages/.../existing-module.ts` — gdzie jest typ / interfejs do rozszerzenia

## Plan

### Step 1 — {krótki tytuł decyzji}

- **Plik:** `packages/.../target.ts`
- **Zmiana:** …
- **Done when:** …

### Step 2 — {następna decyzja}

- **Plik:** `packages/.../__tests__/target.test.ts`
- **Zmiana:** …
- **Done when:** …

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `packages/...`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Wszystkie kroki Plan wykonane
- [ ] Weryfikacja zielona

## Po zakończeniu

1. Commit `Fixes {ID}: …`
2. `npm run queue:close -- --id {ID} --note "…"`

# DUST-25 — Adapter falsegreen (fałszywie zielone testy)

**Queue:** `DUST-25` | **Epic:** DUST | **Segment:** core | **Layer:** 25

## Overview

Raport pokazuje testy, które udają ochronę (tautologie, brak asercji, słaby oracle), z dowodem i podpowiedzią, żeby zastąpić je sensownym dowodem (pin-gate / CLI). Narzędzie nie rusza kodu skanowanego repo.

## Read first

1. `packages/core/src/adapter.ts` — port Adapter / AdapterContext
2. `packages/core/src/adapters/jscpd/run.ts` — wzorzec temp hardlink tree + CLI
3. `packages/contract/src/finding.ts` — zamknięta lista kind

## Plan

### Step 1 — Kontrakt

- **Plik:** `packages/contract/src/finding.ts`
- **Zmiana:** nowy `FindingKind`: `false-green-test` (kategoria `refactor-signal`)
- **Done when:** Zod przyjmuje finding z tym kindem

### Step 2 — Uruchomienie falsegreen-js

- **Plik:** `packages/core/src/adapters/falsegreen/run.ts`
- **Zmiana:** zależność `falsegreen-js`; skan tylko plików z rolą `test` (bez segmentu `.tmp`); temp hardlink tree; `--format json`; exit 0/10/20 = OK
- **Done when:** fixture z `expect(true).toBe(true)` → finding

### Step 3 — Normalizacja

- **Plik:** `packages/core/src/adapters/falsegreen/normalize.ts`
- **Zmiana:** allowlist kodów (C5, C7, C44, JS25, C2, C2b, C6, C11a, JS2, JS27); high→high, allowlist low→medium; fingerprint z treści
- **Done when:** C16/C8/JS8 nie wchodzą do raportu przy domyślnych opcjach

### Step 4 — Rejestr + testy

- **Plik:** `packages/core/src/adapters/index.ts`, fixture, testy
- **Zmiana:** `falsegreenAdapter()` w `builtinAdapters`; happy + negative path
- **Done when:** `npm run verify` zielone; CLI na fixture pokazuje `false-green-test`

## Constraints

- Zero zapisu w skanowanym repo; temp tylko pod `os.tmpdir`
- Zero wiedzy o konkretnym projekcie użytkownika (tylko generyczna reguła `.tmp` + allowlist)
- Obejścia, `@ts-ignore`, `as any` — zakaz

## Pliki (scope)

- `packages/contract/src/finding.ts`
- `packages/core/src/adapters/falsegreen/**`
- `packages/core/src/adapters/index.ts`
- `packages/core/__tests__/falsegreen-adapter.test.ts`
- `packages/core/fixtures/falsegreen-basic/**`
- `packages/core/package.json`, `package-lock.json`
- `docs/briefs/DUST-25-adapter-falsegreen.md`
- `docs/briefs/queue.json`
- `docs/briefs/DUST-00-overview.md`

## Weryfikacja

```bash
npm run verify
# CLI scan fixture → report contains false-green-test
# smoke Monorepo-A → tens of findings, no /.tmp/ paths
```

## Wyjście (acceptance)

- [ ] Wszystkie kroki Plan wykonane
- [ ] Weryfikacja zielona

## Po zakończeniu

1. Commit `Fixes DUST-25: …`
2. `node tools/queue/close.mjs --id DUST-25 --note "…"`

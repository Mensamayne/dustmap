# DUST-13 — Wtyczka „briefy do kolejki”

**Queue:** `DUST-13` | **Epic:** DUST | **Segment:** core | **Layer:** 13

## Overview

Wybrane przez człowieka lub agenta znaleziska zamieniają się w zadania w kolejce plikowej (`queue.json` + brief markdown), takiej jak w tym repo i w Monorepo-A. Ścieżki i szablon są w konfiguracji, więc każdy projekt z podobną kolejką podłącza to bez kodu. Ten sam fingerprint drugi raz = brak nowego zadania. Nic nie trafia do kolejki samo.

## Plan

### Step 1 — Sink

- **Plik:** `packages/sink-briefs/`
- **Zmiana:** `dustmap-briefs enqueue <fingerprint…>`; config `sinks.briefs = { queuePath, briefsDir, template, idPrefix, defaults: { segment, kind } }`. Brief: dowód, lokacje, `verifyHint` w sekcji „Weryfikacja”, lokacje w „Pliki (scope)”. Wpis w kolejce: `source: "dustmap:<fingerprint>"`, gates puste.
- **Done when:** test: dwa wywołania z tym samym fingerprintem = jeden brief i jeden wpis.

### Step 2 — Zgodność z kolejką tego repo

- **Plik:** `packages/sink-briefs/__tests__/queue-compat.test.ts`
- **Zmiana:** wpis wygenerowany na fixture przechodzi walidację `docs/briefs/queue.schema.json` (JSON Schema, ten sam co w kolejce Monorepo-A) oraz `node tools/queue/validate.mjs` uruchomione na kopii tego repo z dopisanym wpisem.
- **Done when:** test zielony.

### Step 3 — Przewodnik integracji

- **Plik:** `docs/INTEGRATION-QUEUE.md`
- **Zmiana:** jak podłączyć do repo z kolejką plikową, przykład configu dla monorepo Next + paczki (punkty wejścia: trasy `app/**`, rejestr akcji, `bin` paczek, skrypty `tools/**`, pliki ładowane po nazwie).
- **Done when:** przykład configu przechodzi walidację Zod z DUST-02.

## Constraints

- Zakaz automatycznego `enqueue` całego raportu — tylko wskazane fingerprinty
- Zakaz nadpisywania istniejących briefów

## Pliki (scope)

- `packages/sink-briefs/**`
- `docs/INTEGRATION-QUEUE.md`
- `package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

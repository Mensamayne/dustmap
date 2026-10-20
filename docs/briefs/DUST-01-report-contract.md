# DUST-01 — Kontrakt raportu v1

**Queue:** `DUST-01` | **Epic:** DUST | **Segment:** core | **Layer:** 1

## Overview

Paczka `@dustmap/contract` (Zod) definiuje jedyny format, który zna reszta świata: raport, znalezisko, decyzję. Agent, CLI, MCP i wtyczki czytają tylko ten kontrakt — nigdy surowego wyjścia Knip / jscpd.

## Plan

### Step 1 — Paczka i schemat znaleziska

- **Plik:** `packages/contract/src/finding.ts`
- **Zmiana:** `Finding` = `{ fingerprint, kind, category, locations[], evidence[], confidence: low|medium|high, suggestedAction, verifyHint, source }`. `category`: `dead-code` | `duplicate` | `semantic-duplicate` | `refactor-signal` | `structure`. `kind` = zamknięta lista (np. `unused-export`, `clone-cluster`, `hotspot`, `co-change`, `cycle`). `evidence` = pary `{ label, value }` czytelne dla człowieka.
- **Done when:** parse round-trip; reject nieznany `kind`, puste `locations`.

### Step 2 — Raport i metadane skanu

- **Plik:** `packages/contract/src/report.ts`
- **Zmiana:** `Report` = `{ schema: "dustmap.report/v1", scan: { mode: full|diff, commit, baseRef?, startedAt, tools[{name, version}] }, summary: { byCategory, topPlaces[] }, findings[] }`. Ścieżki zawsze POSIX, względne do root repo.
- **Done when:** ścieżka z `\` albo absolutna pada w Zod.

### Step 3 — Fingerprint

- **Plik:** `packages/contract/src/fingerprint.ts`
- **Zmiana:** `fingerprint(kind, normalizedSnippets[], symbolNames[])` → sha256 hex 16; normalizacja: bez białych znaków, bez komentarzy, bez numerów wierszy. Kolejność lokacji nie zmienia wyniku.
- **Done when:** przesunięcie kodu o 10 wierszy = ten sam fingerprint; zmiana treści = inny.

### Step 4 — Decyzje i SARIF

- **Plik:** `packages/contract/src/decisions.ts`, `src/sarif.ts`
- **Zmiana:** `Decision` = `{ fingerprint, verdict: keep|fix|wontfix, reason (min 10 znaków), by, at }` (plik YAML w repo użytkownika). `toSarif(report)` → SARIF 2.1.0 (reguła = `kind`, poziom z `confidence`).
- **Done when:** SARIF przechodzi walidację schematu 2.1.0 (fixture); decyzja bez powodu pada.

## Constraints

- Zero wiedzy o konkretnym projekcie użytkownika (ścieżki, nazwy) w kodzie paczki
- Zakaz `as any` / `@ts-ignore`
- Brak pola „usuń automatycznie” w kontrakcie

## Pliki (scope)

- `packages/contract/**`
- `package.json` (workspace + skrypt `verify`)
- `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [x] Schemy parse/reject z testami
- [x] Fingerprint stabilny przy przesunięciu kodu
- [x] SARIF 2.1.0 zgodny ze schematem

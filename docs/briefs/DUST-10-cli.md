# DUST-10 — CLI `dustmap`

**Queue:** `DUST-10` | **Epic:** DUST | **Segment:** core | **Layer:** 10

## Overview

Jedno CLI do całości: `dustmap init`, `dustmap scan [--diff <ref>]`, `dustmap summary`, `dustmap show <fingerprint>`, `dustmap decide <fingerprint> keep|fix|wontfix --reason …`, `dustmap export --to markdown|sarif`, `dustmap ratchet [--update-baseline]`. Wyjście domyślnie krótkie; `--json` dla maszyn.

## Plan

### Step 1 — Paczka i komendy

- **Plik:** `packages/cli/`
- **Zmiana:** `bin/dustmap.mjs`; komendy jak wyżej; kody wyjścia 0 = OK, 1 = znaleziska blokujące (ratchet), 2 = błąd użycia/konfiguracji.
- **Done when:** test e2e na fixture: init → scan → summary → decide → scan (znalezisko znika).

### Step 2 — Eksport markdown i SARIF

- **Plik:** `packages/cli/src/export/`
- **Zmiana:** markdown = top miejsca + lista per kategoria z dowodami (dla ludzi, do PR / issue); SARIF z kontraktu DUST-01.
- **Done when:** snapshot markdown dla fixture; SARIF przechodzi schemat.

### Step 3 — README paczki

- **Plik:** `packages/cli/README.md`
- **Zmiana:** instalacja jedną komendą, przykład pierwszego raportu, opis kategorii, zasada „report-only”. Po angielsku (publikacja). Od teraz to SSOT opisu narzędzia (zastępuje overview DUST-00 jako opis dla świata).
- **Done when:** README zawiera każdą komendę z `--help`.

## Constraints

- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek
- Żadna komenda nie zmienia plików źródłowych

## Pliki (scope)

- `packages/cli/**`
- `package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
```

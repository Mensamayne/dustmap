# REL-03 — Prywatne dane poza publicznym drzewem

**Queue:** `REL-03` | **Epic:** REL | **Segment:** release | **Layer:** 2

## Overview

W publicznym repo nie ma ścieżek, nazw funkcji ani opisów kodu prywatnych projektów maintainera. Dane referencyjne złota z prywatnych migawek, konfiguracje celów i lista nazw prywatnych projektów żyją w katalogu poza gitem (`private/` w `.gitignore`); narzędzia czytają je stamtąd, a bez nich działają na samej części publicznej. Dokumenty mówią „duży prywatny monorepo TypeScript (1,27 mln linii)” i „mały prywatny serwis” — liczby zostają.

## Plan

### Step 1 — Dane i konfiguracje

- **Plik:** `tools/**`, `.gitignore`
- **Zmiana:** pliki z referencjami prywatnymi → `private/`; ładowanie z `private/` gdy jest; bramka izolacji: nazwy z pliku lokalnego (publicznie: mechanizm + self-test)
- **Done when:** u maintainera działa jak dziś; świeży klon bez `private/` zielony

### Step 2 — Dokumenty

- **Plik:** `docs/**`, `AGENTS.md`, `README.md`
- **Zmiana:** nazwy prywatnych projektów, ich ścieżki i nazwy funkcji → opisy ogólne
- **Done when:** `git grep -i` po liście nazw (z pliku lokalnego) pusty w drzewie

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `tools/**`, `docs/**`, `AGENTS.md`, `README.md`, `.gitignore`, `package.json` (skrypty), `packages/*/__tests__/**` (nazwy w testach)

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Drzewo bez nazw prywatnych projektów
- [ ] Narzędzia maintainera działają z `private/`

## Po zakończeniu

1. Commit `Fixes REL-03: …`
2. `node tools/queue/close.mjs --id REL-03 --note "…"`

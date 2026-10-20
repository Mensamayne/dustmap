# EMB-11 — Dystrybucja modelu publicznego

**Queue:** `EMB-11` | **Epic:** EMB | **Segment:** semantic | **Layer:** 11

## Overview

Obcy użytkownik Dustmapa dostaje model jedną jawną komendą (`dustmap model pull`), wie, co pobiera i na jakiej licencji, a potem wszystko działa offline. Model prywatny nie da się opublikować nawet przez pomyłkę.

## Plan

### Step 1 — Karta modelu

- **Plik:** `../dustmap-emb/dist/<model-id>/MODEL-CARD.md`
- **Zmiana:** do czego służy, na jakich danych (manifest z EMB-06: tylko syntetyczne + wolne licencje), wyniki z `emb-results.md`, ograniczenia, licencja modelu bazowego i własna
- **Done when:** karta zgodna z manifestem

### Step 2 — Komenda pobrania

- **Plik:** `packages/cli/src/model-cmd.ts`, `packages/cli/src/args.ts`, `packages/cli/README.md`
- **Zmiana:** `dustmap model pull <id>` / `dustmap model list`: pobiera do katalogu modeli użytkownika, sprawdza SHA-256 z manifestu, odmawia paczki z `private: true`; jedyna komenda Dustmapa z siecią, zawsze jawna
- **Done when:** test z lokalnym serwerem HTTP: zła suma = odmowa, nic nie zostaje na dysku

### Step 3 — Miejsce publikacji

- **Plik:** `docs/OPEN-DECISIONS.md`
- **Zmiana:** decyzja maintainera, gdzie leży model (wydania GitHub / rejestr modeli) — zależy od otwartych decyzji 1–3 (licencja, właściciel, nazwa)
- **Done when:** decyzja wpisana; publikacja dopiero po niej

## Constraints

- Publikacja = działanie na zewnątrz → tylko na jawne polecenie maintainera
- Offline-first: bez pobranego modelu Dustmap mówi, co zrobić, i działa dalej bez semantyki

## Pliki (scope)

- `packages/cli/**`, `docs/OPEN-DECISIONS.md`, `../dustmap-emb/dist/**`

## Weryfikacja

```bash
npm run verify
```

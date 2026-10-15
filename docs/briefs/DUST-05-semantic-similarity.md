# DUST-05 — Podobieństwo po sensie (embeddingi)

**Queue:** `DUST-05` | **Epic:** DUST | **Segment:** core | **Layer:** 5

## Overview

Raport pokazuje „te 5 funkcji robi praktycznie to samo”, także gdy są napisane inaczej. Każda funkcja zamieniana jest na wektor lokalnym modelem kodowym; bliskie wektory łączone w klastry. Działa offline, kolejny skan liczy tylko zmienione funkcje.

## Read first

1. **[docs/experiments/embedding-spike.md](../experiments/embedding-spike.md) (DUST-15)** — wynik pomiaru na Monorepo-A: domyślnie włączone czy nie, model, próg. Ten brief realizuje tamtą decyzję.
2. jscpd `--semantic` (eksperymentalne od 5.3) — sprawdź aktualny stan flag w README jscpd przed kodem

## Plan

### Step 1 — Dostawca embeddingów (wymienny)

- **Plik:** `packages/core/src/semantic/provider.ts`
- **Zmiana:** `EmbeddingProvider` z dwoma implementacjami: `jscpd-semantic` (model wbudowany jscpd) i `openai-compatible` (URL z configu, np. lokalna Ollama; klucz tylko z env). Domyślnie lokalny; URL spoza `localhost` wymaga jawnego `allowRemote: true`.
- **Done when:** test: zdalny URL bez `allowRemote` = czytelny błąd, zero wysłanych żądań.

### Step 2 — Funkcje, cache, klastry

- **Plik:** `packages/core/src/semantic/cluster.ts`
- **Zmiana:** jednostka = funkcja/metoda powyżej progu tokenów (bez komentarzy); cache wektora po hashu treści + id modelu; klastry (próg podobieństwa z configu) → `semantic-duplicate`, `evidence`: podobieństwo min/max, liczba funkcji, nazwy.
- **Done when:** fixture z 3 implementacjami tej samej funkcji (pętla / reduce / rekurencja) → jeden klaster; drugi skan = 0 nowych embeddingów.

### Step 3 — Rozdział od kopiuj-wklej

- **Plik:** `packages/core/src/semantic/dedupe-vs-clones.ts`
- **Zmiana:** klaster już w pełni pokryty przez `clone-cluster` z DUST-04 nie jest raportowany drugi raz.
- **Done when:** test na fixture z dosłowną kopią.

## Constraints

- Pliki wejściowe z ról (DUST-20): domyślnie `filesWithRole("source")`; nigdy `generated` / `vendored` / `minified` / `oversized`
- Brak sieci domyślnie; zero wysyłki kodu bez jawnej zgody w configu
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/semantic/**`
- `packages/core/__tests__/**`, `fixtures/**`
- `packages/core/package.json`, `package-lock.json`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

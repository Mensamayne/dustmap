# DUP-04 — L4: sędzia par — mały model par nauczony na ocenach Qwena

**Queue:** `DUP-04` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 3

## Overview

Rozstrzygnięcie pary przez model, który widzi oba kawałki naraz (cross-encoder, ok. 150 mln parametrów), nauczony na ocenach lokalnego Qwen 7B (AP 0,80 na teście bez treningu). Działa na CPU, szybko. Qwen zostaje opcją przy karcie, agent ostatnim słowem.

## Read first

1. `docs/architecture/duplicates-paradigm.md`
2. `docs/briefs/DUP-00-overview.md`

## Plan

### Step 1 — Pary do oceny

- **Plik:** `../dustmap-emb/data/judge/candidates.py`
- **Zmiana:** kandydaci z L3 w losowej kolejności, co najmniej 5 linii, bez kodu testowego, różne pasma podobieństwa
- **Done when:** próbka reprezentatywna nawet po przerwaniu

### Step 2 — Oceny Qwena

- **Plik:** `../dustmap-emb/data/judge/llm_judge.py`
- **Zmiana:** porcje liczone tokenami, limit pamięci karty; progi z części walidacyjnej
- **Done when:** co najmniej 20 tys. ocen, bez przepełnienia pamięci

### Step 3 — Trening cross-encodera

- **Plik:** `../dustmap-emb/` (skill train-sentence-transformers, bez publikacji)
- **Zmiana:** CrossEncoder na ocenach Qwena (miękkie etykiety), wybór po walidacji
- **Done when:** AP na teście ≥ 0,80; ≥ 50 par/s na CPU

### Step 4 — Wpięcie w skan

- **Plik:** `packages/core/src/semantic/**`
- **Zmiana:** pary z L3 przechodzą przez sędziego; pewność z jego kalibracji
- **Done when:** Monorepo-A: przegląd 30 grup, precyzja high ≥ 0,9

## Constraints

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie
- Ogólne reguły, bez wiedzy o konkretnym repo
- Prywatny kod i model nie opuszczają komputera

## Pliki (scope)

- `../dustmap-emb/data/judge/**`
- `../dustmap-emb/configs/**`
- `packages/core/src/semantic/**`
- `docs/experiments/dup-results.md`

## Weryfikacja

```bash
npm run dup:meter
npm run verify
```

## Wyjście (acceptance)

- [ ] Sędzia par AP ≥ 0,80 na teście, ≥ 50 par/s na CPU
- [ ] Wpięty w skan z kalibracją

## Po zakończeniu

1. Commit `Fixes DUP-04: …`
2. `node tools/queue/close.mjs --id DUP-04 --note "…"`

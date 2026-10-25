# V1-03 — Miernik dla dowolnego sędziego

**Queue:** `V1-03` | **Epic:** V1 | **Segment:** duplicates | **Layer:** 2

## Overview

`npm run dup:meter` mierzy każdego sędziego tą samą fabryką co skan — paczkę, API zgodne z OpenAI, Anthropic — na tym samym złocie, z limitem par (koszt API) i pamięcią ocen. Użytkownik albo agent widzi jakość przed wyborem.

## Plan

### Step 1 — Fabryka w mierniku

- **Plik:** `tools/emb/dup-meter.mts`
- **Zmiana:** `--judge-provider`, `--judge-model`, `--judge-url`, `--judge-limit` (losowa, stała próbka testu); raport: AP, precyzja @0,5, pułapka, wywołania / z pamięci
- **Done when:** paczka daje te same liczby co dziś; API sprawdzone na nagranym serwerze

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Kod poza komputer tylko po jawnym `allowRemote: true`; klucze API tylko ze zmiennych środowiskowych, nigdy z konfiguracji ani raportu
- GPU: ≤ 8 GB i ≤ wolne − 0,5 GB wg nvidia-smi
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `tools/emb/dup-meter.mts`
- `docs/experiments/dup-results.md`

## Weryfikacja

```bash
npm run dup:meter -- --no-l3 --judge-provider onnx
npm run verify
```

## Wyjście (acceptance)

- [ ] Każdy dostawca sędziego mierzalny jedną komendą

## Po zakończeniu

1. Commit `Fixes V1-03: …`
2. `node tools/queue/close.mjs --id V1-03 --note "…"`

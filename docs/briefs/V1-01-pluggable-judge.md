# V1-01 — Jeden wymienny sędzia par: paczka / API OpenAI / API Anthropic / brak

**Queue:** `V1-01` | **Epic:** V1 | **Segment:** duplicates | **Layer:** 1

## Overview

Użytkownik wybiera sędziego par jednym ustawieniem: nasza paczka ONNX, dowolne API zgodne z OpenAI (GPT, lokalny vLLM / Ollama / llama.cpp), API Anthropic (Claude) albo brak. Każdy sędzia czyta kod obu stron i daje prawdopodobieństwo „ta sama robota”; skan używa go tak samo, bez względu na dostawcę. Stary sędzia LLM (DUST-14, tylko komentarz bez kodu) znika. Zmiana modelu wektorowego albo sędziego nie oddaje starych wyników z pamięci podręcznej.

## Read first

1. `packages/core/src/semantic/pair-judge.ts` — sędzia ONNX
2. `packages/core/src/judge/**` — klienty API (do przejęcia), adnotacje (do usunięcia)
3. `packages/core/src/scan/run-scan.ts` — cache adapterów (klucz: wersja + pliki, bez konfiguracji)

## Plan

### Step 1 — Konfiguracja

- **Plik:** `packages/core/src/config/schema.ts`
- **Zmiana:** sekcja `judge`: `provider` (onnx | openai | anthropic | none, domyślnie onnx), `model`, `url`, `allowRemote`, `device`, `maxPairs`, `minBand`; `semantic.pairJudge` i `semantic.judgedMinBand` przeniesione tutaj
- **Done when:** jedna sekcja; stare klucze odrzucone z jasnym błędem

### Step 2 — Sędzia API

- **Plik:** `packages/core/src/judge/**`
- **Zmiana:** para kodu → etykieta (same / contains / concept / pattern / different) + powód, JSON; wynik = prawdopodobieństwo tej samej roboty; pamięć podręczna ocen pod `outputDir` (model + skrót pary); limit par na skan
- **Done when:** testy na nagranych odpowiedziach obu formatów, zero sieci w testach

### Step 3 — Skan

- **Plik:** `packages/core/src/semantic/**`, `packages/core/src/scan/run-scan.ts`, `packages/core/src/adapter.ts`
- **Zmiana:** semantyka używa fabryki sędziego; pole `judgement` (werdykt, powód, model) wypełnia sędzia par; wersja adaptera semantycznego zawiera model wektorowy i sędziego
- **Done when:** zmiana modelu = nowe wyniki; `none` = sama podobieństwo

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Kod poza komputer tylko po jawnym `allowRemote: true`; klucze API tylko ze zmiennych środowiskowych, nigdy z konfiguracji ani raportu
- GPU: ≤ 8 GB i ≤ wolne − 0,5 GB wg nvidia-smi
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `packages/core/src/judge/**`, `packages/core/src/semantic/**`, `packages/core/src/config/schema.ts`, `packages/core/src/adapter.ts`, `packages/core/src/scan/run-scan.ts`, `packages/core/src/index.ts`, `packages/core/__tests__/**`
- `packages/contract/src/finding.ts` (opis pola `judgement`)
- `packages/mcp/src/tools.ts`, `packages/cli/src/**` (odczyt `judgement`)
- `tools/emb/dup-meter.mts`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Cztery tryby sędziego z jednego ustawienia
- [ ] Klucze tylko z env; zdalnie tylko po `allowRemote`
- [ ] Zmiana modelu lub sędziego unieważnia cache

## Po zakończeniu

1. Commit `Fixes V1-01: …`
2. `node tools/queue/close.mjs --id V1-01 --note "…"`

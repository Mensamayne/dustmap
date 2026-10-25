# REL-02 — Modele dla obcych użytkowników

**Queue:** `REL-02` | **Epic:** REL | **Segment:** release | **Layer:** 1

## Overview

Obcy użytkownik bez modeli dostaje czysty raport ze spokojną notatką, jak włączyć model — nie błąd narzędzia. Domyślne id to model **publiczny** (`dustmap-same-meaning-public`, Apache-2.0, uczony tylko na kodzie MIT/Apache/BSD); publicznego sędziego nie ma — domyślnie brak sędziego, w dokumentacji API / Ollama. `dustmap model pull` ma domyślne źródło: repo modelu na Hugging Face. Maintainer wpisuje prywatne id w swoich konfiguracjach. Wgranie paczki na Hugging Face — dopiero po „tak” maintainera.

## Plan

### Step 1 — Brak modelu = notatka

- **Plik:** `packages/core/src/semantic/**`, `packages/core/src/judge/**`, `packages/core/src/scan/**`
- **Zmiana:** nie zainstalowany model to notatka skanu z poleceniem (`dustmap model pull …`, `docs/MODELS.md`), nie błąd narzędzia
- **Done when:** test: skan bez modeli → brak błędów narzędzi, notatka obecna

### Step 2 — Domyślne publiczne

- **Plik:** `packages/core/src/config/schema.ts`, `packages/cli/src/model-cmd.ts`, konfiguracje lab i celów
- **Zmiana:** `semantic.model` = paczka publiczna; `judge.provider` = `none`; domyślne źródło pull = Hugging Face; lab i cele jawnie na prywatnych
- **Done when:** lab zielony na prywatnych; świeży klon bez modeli zielony

### Step 3 — Paczka do wgrania

- **Plik:** `docs/MODELS.md`, karta modelu
- **Zmiana:** karta modelu (licencja, baza, dane, wyniki, ograniczenia); polecenie wgrania gotowe, wykonane po zgodzie
- **Done when:** `model pull` z lokalnego serwera o układzie HF pobiera i weryfikuje paczkę

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `packages/core/src/**`, `packages/core/__tests__/**`, `packages/contract/src/**`, `packages/cli/src/**`, `packages/cli/__tests__/**`, `docs/MODELS.md`, `README.md`, `tools/targets/**`, `tools/release/**`, `../dustmap-lab/**`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Skan bez modeli bez błędów narzędzi
- [ ] Domyślnie model publiczny; pull z HF gotowy

## Po zakończeniu

1. Commit `Fixes REL-02: …`
2. `node tools/queue/close.mjs --id REL-02 --note "…"`

- Zmiana w trakcie: Step 3 (karta modelu, wgranie, domyślne źródło `model pull`) przeniesiony do **REL-06** — maintainer nie ma jeszcze konta na Hugging Face (25.10.2026). Notatka „layer off” mówi więc `dustmap model pull <id> --from <url>` i odsyła do `docs/MODELS.md`. `judge.model` bez wartości domyślnej (wcześniej prywatne id): każdy dostawca poza `none` musi go nazwać.
- Added during work: `packages/core/src/layer-unavailable.ts`, `packages/core/src/index.ts`, `packages/contract/src/report.ts` (pole `note` narzędzia), `packages/cli/src/scan-cmd.ts` (linie `note:` / `error:`), `tools/targets/*.dustmap.config.json` (jawny prywatny sędzia), `tools/emb/dup-meter.mts` nie wymagał zmian

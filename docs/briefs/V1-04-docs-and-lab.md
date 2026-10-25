# V1-04 — Dokumentacja konfiguracji modeli i laboratorium

**Queue:** `V1-04` | **Epic:** V1 | **Segment:** duplicates | **Layer:** 3

## Overview

Użytkownik i agent znajdują gotowe konfiguracje: model wektorowy (paczka / API OpenAI / lokalny serwer / brak) i sędzia (paczka / GPT / Claude / Ollama / brak), z tym, co wychodzi z komputera i ile kosztuje. Laboratorium sprawdza tryby sędziego bez sieci: fałszywy serwer API na loopbacku.

## Plan

### Step 1 — Dokumentacja

- **Plik:** `docs/MODELS.md` (nowy), `README.md`, `packages/cli/agent/PLAYBOOK.md`
- **Zmiana:** konfiguracje z przykładami, prywatność, koszt, wyniki v1
- **Done when:** każdy tryb ma gotowy fragment `dustmap.config.json`

### Step 2 — Laboratorium

- **Plik:** `../dustmap-lab/**`
- **Zmiana:** scenariusz: fałszywy serwer (OpenAI i Anthropic) potwierdza jedną kopię i odrzuca drugą; tryb `none`; brak klucza = jasny błąd
- **Done when:** lab zielony

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Kod poza komputer tylko po jawnym `allowRemote: true`; klucze API tylko ze zmiennych środowiskowych, nigdy z konfiguracji ani raportu
- GPU: ≤ 8 GB i ≤ wolne − 0,5 GB wg nvidia-smi
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `docs/MODELS.md`, `README.md`, `packages/cli/agent/PLAYBOOK.md`
- `../dustmap-lab/**`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Dokumentacja wszystkich trybów
- [ ] Lab: tryby sędziego bez sieci

## Po zakończeniu

1. Commit `Fixes V1-04: …`
2. `node tools/queue/close.mjs --id V1-04 --note "…"`

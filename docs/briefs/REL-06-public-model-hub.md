# REL-06 — Model publiczny na Hugging Face

**Queue:** `REL-06` | **Epic:** REL | **Segment:** release | **Layer:** 4

## Overview

Obcy użytkownik włącza warstwę „ten sam sens” jednym poleceniem: `dustmap model pull dustmap-same-meaning-public` pobiera paczkę z repo modelu na Hugging Face i sprawdza SHA-256 każdego pliku. Czeka na konto maintainera na Hugging Face (25.10.2026: „nie mam jeszcze konta”). Wgranie robi maintainer albo agent po jego „tak”; tokenu HF agent nigdy nie wpisuje — logowanie (`hf auth login`) robi maintainer.

## Plan

### Step 1 — Karta modelu i wgranie

- **Plik:** `docs/models/dustmap-same-meaning-public.md` (karta = README repo modelu), `docs/RELEASE.md`
- **Zmiana:** karta: licencja Apache-2.0, baza `microsoft/unixcoder-base`, dane tylko z licencji MIT / Apache / BSD + syntetyczne, wynik privacy check, AP 0,787, ograniczenia (pary „inny algorytm, ta sama robota”); polecenia wgrania (`hf repos create`, `hf upload`) w układzie `<id>/manifest.json`
- **Done when:** paczka na HF, pobrana na czysty katalog modeli, sumy zgodne

### Step 2 — Domyślne źródło

- **Plik:** `packages/cli/src/model-cmd.ts`, `packages/core/src/semantic/run.ts`, `docs/MODELS.md`, `README.md`
- **Zmiana:** `DEFAULT_MODEL_SOURCE` = `https://huggingface.co/<konto>/dustmap-models/resolve/main`; notatka „layer off” podaje `dustmap model pull <id>` bez `--from`
- **Done when:** test z lokalnym serwerem w układzie HF; świeży klon: pull + skan bez notatki

## Constraints

- Prywatne modele (`*-private`) nigdy nie opuszczają komputera; `model pull` odmawia paczek `private: true`
- Wgranie i push tylko po jawnym „tak” maintainera; tokeny tylko u maintainera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `docs/models/**`, `docs/RELEASE.md`, `docs/MODELS.md`, `README.md`, `packages/cli/src/model-cmd.ts`, `packages/cli/__tests__/**`, `packages/core/src/semantic/run.ts`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] `dustmap model pull dustmap-same-meaning-public` działa bez `--from`

## Po zakończeniu

1. Commit `Fixes REL-06: …`
2. `node tools/queue/close.mjs --id REL-06 --note "…"`

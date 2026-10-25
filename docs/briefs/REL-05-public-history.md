# REL-05 — Publiczna historia

**Queue:** `REL-05` | **Epic:** REL | **Segment:** release | **Layer:** 4

## Overview

Osobny klon z pełną historią, z której `git filter-repo` usunął prywatne pliki i zamienił nazwy prywatnych projektów we wszystkich wersjach plików i w komunikatach commitów. Lokalne repo maintainera zostaje nietknięte. Klon przechodzi `npm ci` + `verify`, a skan całej historii nie znajduje ani nazw, ani sekretów. Push — dopiero po „tak” maintainera.

## Plan

### Step 1 — Przepisanie na klonie

- **Plik:** klon w `.tmp/public-release/` (poza gitem), skrypt `tools/release/`
- **Zmiana:** `--invert-paths` dla plików prywatnych; `--replace-text` i `--replace-message` dla nazw (lista z pliku lokalnego)
- **Done when:** `git log -p --all` bez nazw; `npm ci` + `verify` zielone na HEAD klonu

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `tools/release/**`, `docs/RELEASE.md`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Klon gotowy do pushu, sprawdzony

## Po zakończeniu

1. Commit `Fixes REL-05: …`
2. `node tools/queue/close.mjs --id REL-05 --note "…"`

# REL-04 — Wizytówka: README, licencja, CI

**Queue:** `REL-04` | **Epic:** REL | **Segment:** release | **Layer:** 3

## Overview

Ktoś, kto otwiera repo z CV, w minutę rozumie, co to jest, widzi, że działa (CI zielone), umie to uruchomić ze źródeł i widzi przemyślany sposób pracy (agent-first, kolejka briefów, laboratorium, pomiary). Licencja MIT.

## Plan

### Step 1 — README

- **Plik:** `README.md`
- **Zmiana:** co robi i dla kogo; przykład wyniku; instalacja ze źródeł (bez `npx`, dopóki nie ma npm); MCP dla agentów; warstwy duplikatów i modele; wyniki pomiarów; jak zbudowane (kolejka, lab, bramki); stan projektu
- **Done when:** każde polecenie z README działa na świeżym klonie

### Step 2 — Licencja i metadane

- **Plik:** `LICENSE`, `package.json`, `packages/*/package.json`
- **Zmiana:** MIT; `license`, `repository`, `author`, `keywords`
- **Done when:** brak `UNLICENSED`

### Step 3 — CI i dokumenty dla agentów

- **Plik:** `.github/workflows/ci.yml`, `AGENTS.md`
- **Zmiana:** CI: `npm ci` + `npm run verify` (Ubuntu + Windows, Node 20 i 22); linki AGENTS do umiejętności działają
- **Done when:** kroki workflow przechodzą lokalnie; brak martwych linków

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

## Pliki (scope)

- `README.md`, `LICENSE`, `package.json`, `packages/*/package.json`, `package-lock.json`, `.github/**`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.claude/skills/**`, `docs/**`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] README prawdziwe co do joty
- [ ] MIT, CI

## Po zakończeniu

1. Commit `Fixes REL-04: …`
2. `node tools/queue/close.mjs --id REL-04 --note "…"`

- Added during work: `packages/cli/src/init-agent.ts` + test (wpis MCP dla obcego repo wskazuje serwer obok CLI zamiast nieopublikowanej paczki npm), `packages/cli/README.md` (sekcja modeli), `docs/OPEN-DECISIONS.md` (licencja i GitHub rozstrzygnięte)

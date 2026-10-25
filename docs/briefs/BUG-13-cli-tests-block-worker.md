# BUG-13 — Testy CLI blokują wątek vitest i padają na „Timeout calling onTaskUpdate”

**Queue:** `BUG-13` | **Kind:** bug | **Warstwa:** 100 | **Segment:** cli | **Severity:** medium | **Epik:** BUG

**Źródło:** `npm run verify` w czasie DUP-03/DUP-05, 2026-10-25

## Overview

Naprawić bug: `npm run verify` czasem kończy się błędem „Error: [vitest-worker]: Timeout calling "onTaskUpdate"”. Wszystkie testy przechodzą, ale vitest zgłasza nieobsłużony błąd i weryfikacja jest czerwona. Testy CLI (`cli-e2e.test.ts`, `cli-full-e2e.test.ts`, `init-agent.test.ts`) uruchamiają program przez `spawnSync`. Ten blokuje wątek testów na cały skan. Pełna pętla (init → scan → summary → decide → scan) to 24–32 s blokady przy obciążonej maszynie. W tym czasie wątek nie odpowiada na wywołania vitest, a te mają limit 60 s.

Sprawdzone: to nie warstwa L5 (DUP-05). Wyłączenie kierunku kopii daje ten sam błąd, a w mini-repo testu nie ma żadnych duplikatów. Błąd pojawia się raz na kilka przebiegów, częściej przy obciążonym komputerze.

## Read first

1. `packages/cli/__tests__/cli-full-e2e.test.ts` — funkcja `dustmap()` (spawnSync)
2. `packages/cli/__tests__/cli-e2e.test.ts`, `packages/cli/__tests__/init-agent.test.ts`

## Plan

### Step 1 — reproduce and locate

- **Plik:** `packages/cli/__tests__/*.test.ts`
- **Zmiana:** potwierdź, że błąd znika, gdy program uruchamia się asynchronicznie (wątek testów obsługuje wywołania vitest w trakcie skanu)
- **Done when:** root cause opisany w notatce close

### Step 2 — fix at source

- **Plik:** `packages/cli/__tests__/*.test.ts`
- **Zmiana:** pomocnik uruchamiający bin przez `spawn` z `await` (ten sam kontrakt: status, stdout, stderr), testy `async`
- **Done when:** żadnego `spawnSync` na bin Dustmap w testach CLI

### Step 3 — regression guard

- **Plik:** `packages/cli/__tests__/…`
- **Zmiana:** — (sam test jest strażnikiem: 5 przebiegów `npm test` w `packages/cli` pod obciążeniem bez błędu)
- **Done when:** 5/5 zielonych

## Constraints

- **Scope:** zero plików poza listą w `## Pliki`
- **Anty-maskowanie:** zakaz `--exclude`, `.skip`, `.only`, `it.todo`, podnoszenia limitów czasu jako „naprawy”
- Symptom patch (clamp/trim) gdy bug jest upstream — zakaz
- Naprawa „przy okazji” innych epików — zakaz

## Pliki (zamknięta lista)

- `packages/cli/__tests__/cli-e2e.test.ts`
- `packages/cli/__tests__/cli-full-e2e.test.ts`
- `packages/cli/__tests__/init-agent.test.ts`

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Bug naprawiony minimalnym diffem w plikach z listy
- [ ] Weryfikacja zielona (output w close report, nie deklaracja)

## Po zakończeniu

1. Commit `Fixes BUG-13: …`
2. `npm run queue:close -- --id BUG-13 --note "…"`

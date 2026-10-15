# {ID} — {tytuł}

**Queue:** `{ID}` | **Kind:** bug | **Warstwa:** {N} | **Segment:** {segment} | **Severity:** {severity} | **Epik:** BUG

**Źródło:** {source}

## Overview

Naprawić bug: {description} — minimalny diff, root cause upstream, bez obejść.

## Read first

1. `{location}` — reprodukcja / stack trace
2. …

## Plan

### Step 1 — reproduce and locate

- **Plik:** `{scopeFile}`
- **Zmiana:** zidentyfikuj źródło invariantu (nie symptom clamp)
- **Done when:** root cause opisany w commicie / notatce close

### Step 2 — fix at source

- **Plik:** `{scopeFile}`
- **Zmiana:** {fix}
- **Done when:** invariant przywrócony; brak workaround

### Step 3 — regression guard

- **Plik:** `packages/*/__tests__/…` (tylko test tego buga)
- **Zmiana:** test regresji gdy ścieżka krytyczna
- **Done when:** test zielony lokalnie

## Constraints

- **Scope:** zero plików poza listą w `## Pliki` 
- **Anty-maskowanie:** zakaz `--exclude`, `.skip`, `.only`, `it.todo` w testach i bramkach
- Symptom patch (clamp/trim) gdy bug jest upstream — zakaz
- Naprawa „przy okazji” innych epików — zakaz
- Commit bez prośby maintainera — zakaz

## Pliki (zamknięta lista)

- `{scopeFile}`
- `packages/*/__tests__/…` (tylko test regresji tego buga)

## Weryfikacja

```bash
{verify}
```

## Wyjście (acceptance)

- [ ] Bug naprawiony minimalnym diffem w plikach z listy
- [ ] Weryfikacja zielona (output w close report, nie deklaracja)

## Po zakończeniu

1. Commit `Fixes {ID}: …`
2. `npm run queue:close -- --id {ID} --note "…"`

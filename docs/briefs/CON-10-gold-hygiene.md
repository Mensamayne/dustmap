# CON-10 — Szlifowanie i pielęgnacja zbioru wzorcowego

**Queue:** `CON-10` | **Epic:** CON | **Segment:** semantic | **Layer:** 2

## Overview

Zestaw testowy z prawdziwego kodu nie może gnić: po każdym doleciu par ktoś (albo automat) wyłapuje śmieć i go wyrzuca. Po tym briefie mamy stałe reguły „co jest gównem”, skrypt który to łapie, oraz rytuał przeglądu wyrywkowego — żeby miernik nie uczył się szumu.

## Read first

1. `tools/emb/gold/README.md` — etykiety i źródła
2. `docs/experiments/emb-results.md` — stan liczb i znane braki
3. Audyt 22.10.2026: wyrzucone skill / trywialne lokale / backup+storyboard

## Plan

### Step 1 — Reguły śmiecia (pisemne)

- **Plik:** `tools/emb/gold/README.md` (sekcja „Higiena”)
- **Zmiana:** lista twardych powodów do wyrzucenia: ścieżka poza produktem (np. `.claude/skills`), trywialne jednozdaniowe lokale jako `different`, dumpy `backups/` / całe `storyboard.css`, zdublowane id, brak migawki. Lista „zostawić”: zagnieżdżenia EMB-10 jako negatywy, DS bundle ↔ źródło jako `same`.
- **Done when:** maintainer rozumie reguły bez czytania kodu skryptu

### Step 2 — Automatyczna bramka

- **Plik:** `tools/emb/gold/check-hygiene.mts` (nowy), wywołanie z `validate.mjs` albo `npm run emb:gold`
- **Zmiana:** skrypt czerwieni złoto przy naruszeniu reguł ze Step 1; `--selftest` sadzi po jednej parze na regułę i wymaga czerwonego wyniku
- **Done when:** selftest zielony; obecne `real-refs` przechodzi

### Step 3 — Rytuał przeglądu

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** po każdym większym doleciu (≥ 50 par) obowiązkowy wyrywkowy przegląd (min. 30 par z krótkich fragmentów + nowe źródło) i krótka notka w emb-results: ile wyrzucono, dlaczego
- **Done when:** rytuał opisany; pierwsza notka po CON-03/EMB-10 siostrach już jest albo uzupełniona

### Step 4 — Czyszczenie zaległości

- **Plik:** `tools/emb/gold/real-refs.jsonl`
- **Zmiana:** wyrzucić pary z audytu (skill, trywialne lokale, backup/storyboard) jeśli jeszcze są; dorzucić id do dziennika w emb-results
- **Done when:** te id nie występują w `real-refs`; `npm run emb:gold` OK

## Constraints

- Nie osłabiać etykiet „żeby przeszło” — albo para zostaje z uzasadnieniem, albo wylatuje
- Kod prywatny nadal tylko lokalnie; w gicie same odnośniki
- Nie mieszać z treningiem (CON-09) — tu tylko holdout / złoto

## Pliki (scope)

- `tools/emb/gold/**`
- `docs/experiments/emb-results.md`
- `docs/briefs/CON-00-overview.md` (jedna linia o CON-10 w indeksie epiku, jeśli trzeba)

## Weryfikacja

```bash
npm run emb:gold
npx tsx tools/emb/gold/check-hygiene.mts --selftest
npm run emb:eval -- --selftest
```

## Wyjście (acceptance)

- [ ] Reguły higieny w README
- [ ] Bramka + selftest
- [ ] Rytuał przeglądu w emb-results
- [ ] Zaległy śmieć z audytu usunięty

## Po zakończeniu

1. Commit `Fixes CON-10: …`
2. `node tools/queue/close.mjs --id CON-10 --note "…"`

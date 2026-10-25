---
name: kontynuuj-rozwoj
description: >-
  Kontynuuj rozwój Dustmap — zadania z kolejki docs/briefs/queue.json wg briefu.
  Tryb pojedynczy (jedno zadanie) albo tryb CAŁY EPIK (pętla briefów bez pauz).
  Użyj gdy maintainer mówi: kontynuuj rozwój, continue dev, next task, dalej,
  zrealizuj epik, cały epik, domknij epik.
---

# Kontynuuj rozwój

## Trigger

- **„kontynuuj rozwój”**, *continue dev*, *next task*, *dalej* → jedno zadanie, potem stop (chyba że maintainer kazał iść dalej).
- **„zrealizuj epik”**, **„cały epik”**, **„domknij epik”** → tryb CAŁY EPIK.

## Workflow jednego zadania

1. `npm run queue:next` — wypisuje zadanie i brief, oznacza je jako w toku. Zadanie już w toku jest wznawiane.
2. Przeczytaj **tylko** ten brief (+ sekcję **Read first**). Overview epiku, gdy brief jest niejasny.
3. Zrób kroki **Plan** po kolei. **Constraints** to twarde zakazy. Ruszaj wyłącznie pliki z **Pliki (scope)**.
4. Komendy z **Weryfikacja**, potem pełne `npm run verify`.
5. Commit **od razu**, bez pytania: `git commit -m "Fixes {ID}: …"` — tylko pliki tego briefu, bez cudzych ID w treści.
6. `npm run queue:close -- --id {ID} --note "jedno zdanie kontekstu"`.
7. Raport do maintainera wg [przed-kazda-odpowiedzia](../przed-kazda-odpowiedzia/SKILL.md).

## Tryb CAŁY EPIK

1. `npm run queue:next-epic` (albo `-- --epic {ID}`) — plan briefów w kolejności gates.
2. Przeczytaj overview epiku.
3. Pętla: workflow jednego zadania dla każdego briefu, **bez pytania „czy kontynuować”**. Briefy `[waits for: …]` czekają, aż ich gates będą done.
4. Stop tylko gdy: epik done, brief wymaga decyzji maintainera, albo twardy blocker (czerwona weryfikacja poza scope).
5. Na koniec: krótkie podsumowanie — co teraz umie narzędzie, czego jeszcze nie.

## Gdy coś pada

- Czerwona weryfikacja → napraw w scope briefu. Nie da się → status `blocked` w `queue.json` + powód w `closureNotes`, powiedz maintainerowi po ludzku.
- Brief każe coś sprzecznego z regułami ([AGENTS.md](../../../AGENTS.md)) → stop i zapytaj.
- Zakaz: `.skip`, `.only`, `--exclude`, osłabianie asercji, `@ts-ignore`, `as any`.

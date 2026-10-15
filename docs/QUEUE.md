# Kolejka zadań agenta

Ten sam model pracy co w monorepo Monorepo-A, w wersji odchudzonej: tylko Node, bez PowerShella, bez generatorów raportów.

## Jak to działa

- **[briefs/queue.json](briefs/queue.json)** — jedyne miejsce ze statusami (`todo` → `in_progress` → `done` / `blocked` / `cancelled`).
- **Brief** — jeden plik markdown na zadanie: co ma działać, plan krok po kroku, zakazy, lista plików, które wolno ruszać, komendy weryfikacji.
- **Gates** — zadanie startuje dopiero, gdy wszystkie zadania z `gates` są `done`.
- **Dowód commita (TKR)** — zadanie można zamknąć tylko, gdy w historii git jest commit `Fixes {ID}`. [TKR.md](TKR.md).

## Komendy

| Komenda | Co robi |
|---------|---------|
| `npm run queue:next` | Następne zadanie (feature) gotowe do pracy; oznacza je jako w toku. `--dry` tylko pokazuje |
| `npm run queue:next-bug` | Następny bug wg ważności |
| `npm run queue:next-epic` | Plan całego epiku w kolejności gates (`-- --epic DUST`) |
| `node tools/queue/close.mjs --id ID --note "…"` | Zamyka zadanie; bez commita `Fixes ID` odmawia (`--force` tylko dla maintainera). Przez npm: `npm run queue:close -- -- --id ID` (npm 11 zjada samotne `--id`) |
| `npm run queue:validate` | Sprawdza kolejkę: pola, duplikaty, istniejące briefy i gates, brak cykli |
| `npm run queue:selftest` | Posadzone wady muszą zrobić validate czerwonym (ślepa bramka = fail) |
| `npm run verify` | Kolejka + self-test + typecheck + testy wszystkich paczek |

Architektura pakietów i niezmienniki: [architecture/](architecture/).

## Nowe zadanie

1. Brief z [_TEMPLATE.md](briefs/_TEMPLATE.md) (bug: [_BUG_TEMPLATE.md](briefs/_BUG_TEMPLATE.md)), najwyżej ~45 linii.
2. Wiersz w `queue.json`: `id`, `title`, `layer`, `segment`, `brief`, `gates`, `epic`, `status: "todo"`, `kind`.
3. `npm run queue:validate`.

## Pętla agenta

`queue:next` → przeczytaj brief → zrób kroki planu → komendy z „Weryfikacja” → `npm run verify` → commit `Fixes {ID}: …` → `queue:close` → następne zadanie.

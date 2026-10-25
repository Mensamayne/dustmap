---
name: szukaj-bugow
description: >-
  Szukaj bugów w Dustmap adversarialnie i wpisuj je do kolejki (queue.json +
  brief z _BUG_TEMPLATE). Bez napraw. Użyj gdy maintainer mówi: szukaj bugów,
  find bugs, bug hunt do kolejki.
---

# Szukaj bugów → kolejka

**Cel:** znaleźć bugi i **wpisać je do kolejki**. Sam raport w czacie nie wystarczy. Naprawy tylko, gdy maintainer powie „napraw też”.

## Metoda

1. Zakres: ścieżka od maintainera albo domyślnie kolejno — kontrakt raportu, adaptery, ranking/decyzje, CLI/MCP.
2. Szukaj tego, co łamie obietnice narzędzia (najpierw te, potem reszta):
   - **zapis poza `.dustmap/`** albo jakakolwiek zmiana skanowanego repo,
   - **niestabilny odcisk** (to samo znalezisko → inny fingerprint po przesunięciu kodu),
   - **fałszywe „martwe”** dla plików ładowanych przez framework / skrypty / dynamiczny import,
   - **wysyłka kodu w sieć** bez jawnej zgody w configu,
   - ścieżki Windows (`\`), puste repo, repo bez historii git, ogromne pliki, kodowanie znaków.
3. Każdy bug: konkretna reprodukcja (komenda + fixture), a nie „może się zdarzyć”.
4. Odrzuć duplikaty otwartych bugów z `queue.json`.

## Wpis do kolejki

- Brief z [_BUG_TEMPLATE.md](../../../docs/briefs/_BUG_TEMPLATE.md): `BUG-{NN}-{slug}.md`, **zamknięta lista plików** (plik źródłowy buga + test regresji), konkretne komendy weryfikacji.
- Wiersz w `queue.json`: `kind: "bug"`, `severity` (critical / high / medium / low), `epic: "BUG"`, `gates: []`.
- `npm run queue:validate`.

## Podsumowanie dla maintainera

Ile bugów, które najgroźniejsze — po ludzku, co się psuje dla użytkownika narzędzia. ID w nawiasach.

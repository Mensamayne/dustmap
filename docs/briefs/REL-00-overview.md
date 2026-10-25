# REL-00 — Overview: publiczne wydanie na GitHubie

**Queue:** `REL-00` | **Epic:** REL | **Segment:** release | **Layer:** 0

## Overview

Dustmap idzie na GitHuba jako publiczne repo — flagowy projekt maintainera i wizytówka do CV. Decyzje maintainera (25.10.2026): prywatne projekty **ukryte**; historia **pełna, wyczyszczona** (git filter-repo na osobnym klonie); licencja **MIT**; dla obcych użytkowników **publiczny model** (Hugging Face + `dustmap model pull`), prywatne zostają u maintainera.

Audyt (25.10.2026): sekretów w historii brak; świeży klon po naprawie zamka zależności i briefów CON przechodzi `verify` bez modeli. Do zrobienia: zamek `npm ci`, briefy CON w gicie, polskie słowa w CLI, ścieżka domowa w dokumencie, błąd „model not installed” u każdego obcego, README (stary status, `npx` bez npm), licencja, CI, martwe linki do `.claude/`, 82 pliki z nazwami prywatnych projektów (dane referencyjne złota, konfiguracje celów, wyniki).

## Briefy

| ID | Co |
|---|---|
| REL-01 | Higiena repo: `npm ci`, briefy CON, angielskie CLI, ścieżki lokalne |
| REL-02 | Modele dla obcych: brak modelu = notatka, model publiczny jako domyślny, źródło Hugging Face |
| REL-03 | Prywatne dane poza drzewem: złoto, cele, nazwy projektów w dokumentach |
| REL-04 | Wizytówka: README, LICENSE MIT, metadane pakietów, CI, AGENTS |
| REL-05 | Publiczna historia: filter-repo na klonie, weryfikacja klonu, gotowe do pushu |

## Constraints

- Zmiana źródeł skanowanego repo — zakaz (narzędzie pisze tylko `.dustmap/`)
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Push na GitHuba, wgranie modelu na Hugging Face — tylko po jawnym „tak” maintainera
- Historia lokalnego repo nietknięta: przepisywanie tylko na osobnym klonie
- Prywatne modele (`*-private`) nigdy nie opuszczają komputera
- Obejścia, `@ts-ignore`, `as any`, `.skip` / `.only` — zakaz
- Pliki spoza listy „Pliki (scope)” — zakaz

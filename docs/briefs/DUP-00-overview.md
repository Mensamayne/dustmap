# DUP-00 — Overview: duplikaty i ujednolicenia w pięciu warstwach

**Queue:** `DUP-00` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 0

## Po co

Cel projektu w słowach maintainera: Dustmap dostaje kawałki kodu i mówi *„to są jednakowe rzeczy, robią to samo, ten po lewej to kopia tego po prawej”* albo *„ten CSS to dosłownie tamten, tylko inaczej nazwany”*. Na tej podstawie proponuje ujednolicenia. Clean code, kompleksowo.

Epiki EMB i CON pokazały granicę: model wektorowy dobrze **znajduje** duplikaty (92% partnerów w top-20 na Monorepo-A), ale z zasady nie **rozstrzyga** „ta sama robota” kontra „ten sam szkielet”. Koduje każdy kawałek osobno. Sędzia widzący parę ma 0,80 wobec 0,705. Projekt: [docs/architecture/duplicates-paradigm.md](../architecture/duplicates-paradigm.md), z researchem pokrewnych dziedzin (§2a).

## Decyzje (25.10.2026)

- **Sygnały + szkic ujednolicenia.** Maintainer: „zapisz epik DUP … z decyzją »sygnały + szkic ujednolicenia«”. Znalezisko duplikatu może nieść szkic wspólnej wersji jako dowód, pokazywany tylko, gdy jest bezpieczny. Inwariant bez zmian: Dustmap nigdy nie zmienia kodu użytkownika. AGENTS.md zaktualizowane.
- **Kolejność:** L1 (kopie i CSS po normalizacji) najpierw.
- **Trening modelu wektorowego na rozróżnianie wzorca od duplikatu: koniec.** CON-13 i CON-14 zamknięte jako zastąpione.

## Warstwy

| Warstwa | Co | Bez modelu? |
|---|---|---|
| L1 | dokładne po normalizacji: TS/JS z innymi nazwami lokalnymi; CSS typy I–III (FSE 2014) | tak |
| L2 | prawie kopie, „zawiera” | tak |
| L3 | kandydaci po sensie (model wektorowy, top-k) | model już jest (EMB-15) |
| L4 | rozstrzygnięcie pary (sędzia widzący obie strony) | mały model par / Qwen / agent |
| L5 | wyjaśnienie i szkic: wspólny szkielet + parametry, kierunek kopii z gita, CSS selektor grupujący / mixin z warunkiem kolejności | tak |

## Briefy

| ID | Co | Gates |
|----|----|----|
| DUP-01 | L1: normalizacja TS/JS i CSS (typy I–III), znaleziska z mapą nazw | DUP-00 |
| DUP-02 | L2: prawie kopie i „zawiera” z diffem | DUP-01 |
| DUP-03 | Miernik per warstwa (w tym odnalezienie partnera w top-k) | DUP-01 |
| DUP-04 | L4: sędzia par — mały model par nauczony na ocenach Qwena | DUP-03 |
| DUP-05 | L5: szkic ujednolicenia (anti-unification, bezpieczna parametryzacja, kierunek z gita, CSS grupowanie z zależnościami kolejności) | DUP-02 |
| DUP-06 | Raport i MCP: grupy z warstwą, dowodem i szkicem | DUP-05, DUP-04 |
| DUP-07 | Pomiar na Monorepo-A i w labie, decyzja o domyślnych | DUP-06 |

## Twarde zasady

- Dustmap nigdy nie zmienia kodu użytkownika; szkic to tekst w raporcie.
- Ogólne, nie pod projekt: żadnej wiedzy o konkretnym repo w `packages/*/src`.
- Każda warstwa ma własną miarę; żaden brief nie jest „zrobiony” bez liczby z laboratorium albo celu testowego.
- Prywatny kod i prywatny model nie opuszczają komputera.

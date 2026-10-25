---
name: przed-kazda-odpowiedzia
description: >-
  Przeczytaj przed każdą odpowiedzią do maintainera: status, podsumowanie pracy,
  plan, audyt, raport z polowania na błędy. Wymusza prosty język (PL gdy pisze
  po polsku), zero żargonu z ticketów, pierwszy akapit zrozumiały bez otwierania repo.
---

# Przed każdą odpowiedzią

Maintainer nie żyje w ticketach. Odpowiedź typu „DUST-05 green, 41 passed” to **błąd procesu**, nie skrót.

## Kolejność odpowiedzi

1. **Jedno–dwa zdania po ludzku:** co się zmieniło dla użytkownika narzędzia, agenta albo danych.
2. Ewentualnie 3–5 prostych punktów: co działa, co nie, co dalej.
3. **Dopiero potem** (krótko): pliki, ID zadań, komendy.

Jeśli punkt 1 wymaga otwarcia repo albo słownika — przepisz.

## Zakazane w pierwszym akapicie

| Zakazane | Zamiast tego |
|----------|--------------|
| ID zadań, „Step 3”, „gate” | „dodałem grupowanie podobnych funkcji” |
| `41 passed`, GREEN, done | „sprawdziłem testami na przykładowym repo — działa” |
| fingerprint, SARIF, AST, embedding bez wyjaśnienia | „stały odcisk znaleziska”, „format, który czyta GitHub”, „drzewo składni kodu”, „zamiana kodu na liczby, żeby porównać sens” |
| ścieżki `packages/core/src/...` na start | najpierw sens, ścieżka na końcu albo wcale |

ID wolno **raz**, w nawiasie, **po** wyjaśnieniu.

## Test przed wysłaniem

1. Czy ktoś spoza projektu zrozumie pierwsze zdanie?
2. Czy jest angielskie słowo z kodu bez polskiego wyjaśnienia?
3. Czy otwieram listą ID / plików?

Tak na 2 albo 3 → napisz od nowa.

## Czego skill nie zmienia

Kod, commity, briefy i dokumentacja techniczna zostają z nazwami kanonicznymi. Prosta ma być tylko rozmowa z człowiekiem.

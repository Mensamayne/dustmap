# CON-02 — Wspólne cięcie kodu: funkcje, fragmenty, klasy, reguły CSS

**Queue:** `CON-02` | **Epic:** CON | **Segment:** semantic | **Layer:** 1

## Overview

Jeden moduł w Dustmapie tnie plik na jednostki: funkcje, fragmenty długich funkcji, klasy i reguły CSS. Ten sam moduł jest jedynym źródłem cięcia dla potoku danych w `dustmap-emb`. Dziś potok ma własny ekstraktor (`data/lib/extract.mjs`, inne limity), więc model uczy się na kawałkach innych niż te, które widzi skan. Ta rozbieżność znika.

## Read first

1. `packages/core/src/semantic/extract.ts` — obecne cięcie funkcji (bez komentarzy, dokładne linie)
2. `../dustmap-emb/data/lib/extract.mjs` — ekstraktor potoku danych (do zastąpienia)
3. `docs/briefs/CON-00-overview.md` § Jednostki

## Plan

### Step 1 — Fragmenty

- **Plik:** `packages/core/src/semantic/units.ts` (nowy), `packages/core/src/semantic/extract.ts`
- **Zmiana:** dla funkcji powyżej progu długości: fragmenty jako spójne ciągi instrukcji z jednego bloku, cięte wyłącznie po granicach instrukcji (drzewo składni TypeScript), z zakładką. Próg i długość okna to parametry z domyślnymi wartościami, nie stałe rozsiane po kodzie. Każdy fragment zna funkcję-rodzica i swoje linie.
- **Done when:** testy: fragment nigdy nie przecina instrukcji; suma fragmentów pokrywa ciało funkcji; komentarz nie zmienia odcisku

### Step 2 — Klasy

- **Plik:** `packages/core/src/semantic/units.ts`
- **Zmiana:** jednostka „klasa”: całe ciało bez komentarzy + lista jej metod jako odnośniki do jednostek funkcji (do porównania metoda po metodzie). Dotyczy też obiektów-literałów z co najmniej 2 metodami (porty, adaptery).
- **Done when:** testy na klasie z metodami, getterami, polami-strzałkami i na obiekcie-porcie

### Step 3 — Reguły CSS

- **Plik:** `packages/core/src/semantic/units.ts` (+ parser CSS, jeśli potrzebny: tylko licencja MIT/Apache/BSD, wpis w emb-results)
- **Zmiana:** reguła = selektor(y) + deklaracje, z plików `.css`/`.scss` i z literałów CSS-in-JS, gdy są stałym tekstem. Deklaracje w postaci znormalizowanej (kolejność, białe znaki) jako dodatkowe pole do dowodu, a do modelu trafia tekst reguły.
- **Done when:** testy: reguła z media query, zagnieżdżenie SCSS, CSS-in-JS jako literał

### Step 4 — Potok danych używa tego cięcia

- **Plik:** `../dustmap-emb/data/lib/extract.mjs`, miejsca, które go wołają
- **Zmiana:** potok importuje cięcie z `@dustmap/core` (zbudowana paczka z workspace), własny ekstraktor znika. Limity rozmiaru dla treningu są filtrem po cięciu, nie innym cięciem.
- **Done when:** na jednej migawce Monorepo-A: zbiór jednostek z potoku == zbiór jednostek ze skanu (ta sama liczba, te same linie i odciski); różnica = 0

## Constraints

- Skan Dustmapa nie zmienia jeszcze raportu (nowe kształty znalezisk to epik „Skan v2”). Tu tylko cięcie i eksport jednostek.
- Wiedza o konkretnym projekcie w `packages/*/src` — zakaz
- Bez obejść typów (`as any`, `@ts-ignore`)

## Pliki (scope)

- `packages/core/src/semantic/units.ts`, `packages/core/src/semantic/extract.ts`, `packages/core/src/semantic/index.ts`, `packages/core/src/index.ts`, testy obok
- `../dustmap-emb/data/lib/**` i wywołujące je skrypty `../dustmap-emb/data/**`
- `docs/experiments/emb-results.md` (tylko wpis o pobraniu parsera CSS)

## Weryfikacja

```bash
npm run verify
```

## Wyjście (acceptance)

- [ ] Cztery rodzaje jednostek z testami
- [ ] Potok danych i skan tną identycznie (różnica 0 na migawce)

## Po zakończeniu

1. Commit `Fixes CON-02: …` (osobny commit w `dustmap-emb` dla potoku)
2. `node tools/queue/close.mjs --id CON-02 --note "…"`

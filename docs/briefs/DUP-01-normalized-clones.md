# DUP-01 — L1: kopie po normalizacji (TS/JS) i duplikaty CSS typów I–III

**Queue:** `DUP-01` | **Epic:** DUP | **Segment:** duplicates | **Layer:** 1

## Overview

Skan zgłasza dwa nowe rodzaje znalezisk, bez żadnego modelu i z pewnością z konstrukcji:

- **`exact-clone`**: funkcje i klasy, które po zamianie nazw lokalnych (parametry, zmienne, nazwa samej funkcji) są identyczne. Dowód to mapa nazw (`sum → total`, `items → lines`). Wariant „inne stałe” (napisy, liczby) ma niższą pewność.
- **`css-duplicate`**: reguły CSS równoważne według pracy Mazinanian, Tsantalis, Mesbah (FSE 2014):
  - **typ I:** te same wartości, kolejność wartości w skrótach bez znaczenia;
  - **typ II:** wartości równoważne (kolory w różnych zapisach, `0px` = `0`, skrót z wartościami domyślnymi `padding: 2px 4px` = `2px 4px 2px 4px`);
  - **typ III:** zestaw pojedynczych właściwości = skrót (`border-bottom-*` = `border-bottom`).

  Zgłaszane są całe reguły równoważne pod innymi selektorami oraz wspólne zestawy ≥ 3 deklaracji w regułach jednego pliku. Zawsze w tym samym kontekście `@media` / `@supports`.

## Read first

1. `docs/architecture/duplicates-paradigm.md` §2, §2a (CSS: typy I–III)
2. `packages/core/src/semantic/units.ts` — cięcie na jednostki (CON-02)
3. `packages/core/src/adapter.ts`, `packages/core/src/adapters/index.ts` — port adaptera
4. `packages/contract/src/finding.ts` — zamknięta lista rodzajów znalezisk

## Plan

### Step 1 — Kontrakt

- **Plik:** `packages/contract/src/finding.ts` (+ testy kontraktu)
- **Zmiana:** nowe rodzaje `exact-clone`, `css-duplicate` (kategoria `duplicate`)
- **Done when:** testy kontraktu zielone; SARIF opisuje nowe rodzaje

### Step 2 — Normalizacja TS/JS

- **Plik:** `packages/core/src/clones/normalize-ts.ts` (nowy) + test
- **Zmiana:** z drzewa składni: nazwy *wiązane w jednostce* (parametry, zmienne, wiązania destrukturyzacji, pętli i `catch`, nazwa funkcji/klasy) → znaczniki w kolejności pierwszego wystąpienia. Nazwy właściwości (`a.price`), klucze obiektów i nazwy wolne (wywołania, importy) zostają, bo niosą sens. Dwa odciski: z literałami i z literałami zamienionymi na znaczniki.
- **Done when:** testy: kopia z inną nazwą zmiennej → ten sam odcisk; inna nazwa właściwości (`price` vs `weightG`) → inny; inna wywoływana funkcja → inny; komentarz i formatowanie → bez wpływu

### Step 3 — Normalizacja CSS

- **Plik:** `packages/core/src/clones/normalize-css.ts` (nowy) + test
- **Zmiana:** parser postcss (CSS i SCSS) → reguły z kontekstem at-rule. Deklaracje sprowadzane do pełnych właściwości:
  - rozwinięcie skrótów `margin`, `padding`, `inset`, `border(-side)`, `border-width/style/color`, `gap`, `overflow`, `border-radius`;
  - wartości: kolory → kanoniczne RGBA (nazwy, `#rgb`, `#rrggbb(aa)`, `rgb[a]()`, `hsl[a]()`), zera z jednostką → `0`, wiodące zero, wielkość liter, spacje;
  - kolejność w skrótach bez znaczenia (`border`, `outline`, `border-side`).

  Dla każdej równoważności zapis, który typ (I/II/III) ją dał.
- **Done when:** testy z przykładami z pracy (Gmail: `color: white` = `#fff`; `border-bottom-*` = `border-bottom`; `padding: 2px 4px` = 4 wartości; `border: transparent solid 1px` = `1px solid transparent`)

### Step 4 — Adapter i grupowanie

- **Plik:** `packages/core/src/clones/index.ts`, `run.ts` (nowe), `packages/core/src/adapters/index.ts`, `packages/core/src/config/schema.ts`
- **Zmiana:** adapter `normalized` czyta pliki źródłowe skanu.
  - **TS/JS:** grupy jednostek (funkcje, klasy; minimum rozmiaru w konfiguracji) z tym samym odciskiem. Zostają tylko grupy maksymalne: jednostka zawarta w innej jednostce tej samej grupy wypada.
  - **CSS:** grupy reguł równoważnych (cały zestaw) oraz wspólne zestawy ≥ 3 deklaracji w obrębie pliku.
  - **Pewność:** high dla identycznych po zmianie nazw; medium dla „inne stałe” i dla wspólnych zestawów CSS.
  - **Dowody:** mapa nazw, typy CSS, selektory, deklaracje.
- **Done when:** testy adaptera na małym repo testowym; `npm run verify` zielone

### Step 5 — Lab i cele

- **Plik:** `../dustmap-lab/scenarios/` (nowy scenariusz), `docs/experiments/` (wynik)
- **Zmiana:** scenariusz z zaplanowanymi kopiami (TS z inną nazwą, CSS typów I–III, pułapki: inna właściwość, inna funkcja); skan Monorepo-A i Service-B na migawce
- **Done when:** lab: 100% zaplanowanych znalezione, 0 pułapek; Monorepo-A: przegląd 30 losowych grup, precyzja ≥ 0,95; Service-B: raport krótki

## Constraints

- Bez modeli i bez sieci
- Ogólne reguły — żadnych list wyjątków per projekt
- Kod użytkownika tylko czytany

## Pliki (scope)

- `packages/contract/src/finding.ts`, `packages/contract/src/*.test.ts`, `packages/contract/src/sarif.ts`
- `packages/core/src/clones/**`, `packages/core/src/adapters/index.ts`, `packages/core/src/config/schema.ts`, `packages/core/src/index.ts`, `packages/core/__tests__/**`
- `../dustmap-lab/scenarios/**`, `../dustmap-lab/results/**`, `docs/experiments/dup-results.md`
- Added during work: `packages/core/src/adapter.ts`, `packages/core/src/scan/run-scan.ts`, `packages/core/src/scan/languages.ts` (stylesheets reach only L1, script adapters never see them); `tools/targets/run.mts` (the snapshot marker includes the pathspecs, so adding `*.css` re-extracts it)

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Dwa nowe rodzaje znalezisk w kontrakcie
- [ ] Normalizacja TS/JS i CSS z testami (w tym przykłady z FSE 2014)
- [ ] Lab 100% / 0 pułapek; Monorepo-A precyzja ≥ 0,95 na 30 grupach

## Po zakończeniu

1. Commit `Fixes DUP-01: …`
2. `node tools/queue/close.mjs --id DUP-01 --note "…"`

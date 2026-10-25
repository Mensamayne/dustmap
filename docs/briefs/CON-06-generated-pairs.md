# CON-06 — Pary generowane: rozbudowa, rozkład, klasy, CSS

**Queue:** `CON-06` | **Epic:** CON | **Segment:** semantic | **Layer:** 3

## Overview

Historia nie da dość przykładów każdego rodzaju, zwłaszcza koncepcji rozłożonych inaczej i par CSS. Uzupełniamy je kontrolowanym generowaniem. Lokalny model językowy przerabia jednostkę zgodnie z opisaną operacją, a każdy wynik przechodzi automatyczne sprawdzenie, czy operacja naprawdę zaszła. Limit wariantów na jedną jednostkę nie pozwala, żeby generator zdominował zbiór (lekcja z EMB: ponad 90% przepisanych kopii).

## Read first

1. `../dustmap-emb/data/rewrite/**` — obecne przekształcenia deterministyczne i ich weryfikacja
2. `docs/briefs/CON-00-overview.md` § Definicja

## Plan

### Step 1 — Generator lokalny

- **Plik:** `../dustmap-emb/data/generate/llm.mjs` (nowy), `docs/experiments/emb-results.md`
- **Zmiana:** lokalny model koderski na GPU (licencja Apache/MIT, wagi safetensors albo GGUF z zaufanego źródła, wpis w rejestrze pobrań). Na kodzie prywatnym działa wyłącznie lokalnie. Stała temperatura i ziarno; przy każdej parze zapis promptu i wersji modelu.
- **Done when:** 100 wygenerowanych jednostek parsuje się w ≥ 95%

### Step 2 — Operacje

- **Plik:** `../dustmap-emb/data/generate/ops.mjs` (nowy)
- **Zmiana:** operacje, etykieta wynika z operacji:
  - rozbudowa (dodaj walidację / krok / opcję) → `contains`, `larger` = wynik
  - rozkład (podziel na 2–3 funkcje pomocnicze; para = oryginał ↔ zestaw jako jedna jednostka) → `concept`
  - inny algorytm, ten sam kontrakt → `same`
  - klasa ↔ zbiór funkcji albo inna klasa z tym samym kontraktem → `concept`
  - CSS: skrót ↔ pełny zapis, inny selektor z tymi samymi deklaracjami, zmienne CSS ↔ wartości → `same`
  - zmiana zadania przy tym samym szkielecie (inne pole, inna wielkość) → `pattern` (trudny negatyw)
- **Done when:** każda operacja ma opis i przykład w karcie danych

### Step 3 — Sprawdzenie, że operacja zaszła

- **Plik:** `../dustmap-emb/data/generate/verify.mjs` (nowy)
- **Zmiana:** automatyczne kontrole:
  - `contains`: wynik zawiera ≥ 80% linii oryginału (po normalizacji) i jest dłuższy o ≥ 20%;
  - `same` (inny algorytm): te same wyniki na wspólnych wejściach, gdy jednostka jest wykonywalna (jak w EMB-04);
  - CSS: styl po normalizacji równy;
  - `pattern`: wynik różni się na wspólnych wejściach.

  Nieprzechodzące odrzucamy i liczymy.
- **Done when:** odsetek odrzuceń per operacja w karcie danych; ręczny przegląd 30 par per operacja ≥ 90%

### Step 4 — Limity

- **Plik:** `../dustmap-emb/data/dataset.json`
- **Zmiana:** najwyżej 2 warianty generowane na jednostkę źródłową. Pary generowane to ≤ 40% pozytywów; reszta z historii i prawdziwych klonów.
- **Done when:** bilans w karcie danych spełnia limity

## Constraints

- Prywatny kod nigdy do zewnętrznego API
- Jednostki z zestawu testowego nie są źródłem generowania

## Pliki (scope)

- `../dustmap-emb/data/generate/**`, `../dustmap-emb/data/dataset.json`, `../dustmap-emb/DATA-CARD.md`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
node ../dustmap-emb/data/generate/verify.mjs --selftest
```

## Wyjście (acceptance)

- [ ] Generator lokalny, operacje, kontrole z selftestem
- [ ] Odrzucenia i ręczne przeglądy policzone
- [ ] Limity spełnione

## Po zakończeniu

1. Commit `Fixes CON-06: …`
2. `node tools/queue/close.mjs --id CON-06 --note "…"`

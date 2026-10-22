# Zbiór wzorcowy EMB / CON — pary kawałków kodu z etykietą

Miarka dla modeli „ten sam sens” i „powielona koncepcja” (epiki EMB, CON). Jedna para = dwa kawałki + etykieta:

| Etykieta | Znaczy | Dla modelu |
|----------|--------|------------|
| `same` | ta sama odpowiedzialność: kopia, rozjechana kopia, inny algorytm, inna stała lub warunek, przed i po poprawce | pozytyw |
| `contains` | jeden jest rozbudowaną wersją drugiego albo zawiera go jako fragment; mniejszy da się wyrzucić na rzecz większego | pozytyw (asymetryczny: pole `larger: "a" \| "b"`) |
| `concept` | ta sama koncepcja w innym kształcie: inny podział na funkcje, klasa a zbiór funkcji, dwie klasy z pokrywającymi się metodami | pozytyw (słabszy) |
| `pattern` | wspólny szkielet, inne zadanie; to samo działanie na innym polu lub innej wielkości z tych samych danych (suma a liczba, pole A a pole B) | negatyw (trudny) |
| `different` | inne zadanie; wywołujący i wywoływany; odwrotność (zapis a odczyt); ta sama nazwa, inna robota | negatyw |

Pozytywy w mierniku: `same` + `contains` + `concept`. Każda para ma stałą część: `validation` (~1/3 — tylko do kalibracji progów) albo `test` (odłożona: nigdy do treningu, nigdy do strojenia).

## Definicja z przykładami (CON-00 / CON-01)

### `same`

- **Funkcja:** suma dodatnich przez pętlę / `reduce` / rekurencję — ta sama robota, inny zapis.
- **Fragment:** dwa bloki w różnych funkcjach, które walidują ten sam formularz tymi samymi regułami.
- **Klasa:** `UserRepository` i `AccountRepository` z tą samą listą metod na tych samych polach użytkownika (to samo dane, dwie nazwy).
- **CSS:** `.btn-primary { color: #fff; background: blue }` i `.cta { color: white; background-color: blue }` — te same deklaracje, inne selektory / zapis.

### `contains`

- **Funkcja:** `parseDate(s)` czyta ISO; `parseDateOrToday(s)` robi to samo i podstawia dzisiejszą datę przy pustym wejściu → `larger: "b"`.
- **Fragment:** długa funkcja ma w środku 15 linii, które robią to samo co osobna `normalizePath` → większa strona to ta z długą funkcją.
- **Klasa:** `CachedStore` dziedziczy / owija `Store` i dodaje cache — metody bazowe są zawarte w większej klasie.
- **CSS:** reguła A ustawia `margin` i `padding`; reguła B ustawia tylko `margin` z tą samą wartością → A zawiera B.

### `concept`

- **Funkcja:** jedna długa `checkout()` vs trzy pomocnicze `validateCart` + `charge` + `ship` w innym pliku — ten sam pomysł, inny podział.
- **Fragment:** ten sam algorytm rabatów raz w środku handlera, raz jako osobna klasa strategii.
- **Klasa:** klasa `AuthService` z metodami login/logout vs zestaw wolnych funkcji `login` / `logout` o tym samym kontrakcie.
- **CSS:** ten sam „karta z cieniem” raz jako jedna reguła, raz jako kompozycja `.card` + `.elevation-2`.

### `pattern`

- **Funkcja:** `sum(items)` i `count(items)` — ta sama pętla, inna wielkość; `findUserById` i `findOrderById` — ta sama operacja na innej encji.
- **Fragment:** dwa bloki `try/catch` wokół różnych wywołań HTTP.
- **Klasa:** generyczne repozytoria `UserRepo` i `OrderRepo` o tym samym szkielecie CRUD, innych typach.
- **CSS:** `.m-1 { margin: 4px }` i `.p-1 { padding: 4px }` — ten sam wzorzec utility, inne właściwości.

### `different`

- **Funkcja:** `encode` i `decode`; `normalizeText` i `normalizeVector` (ta sama nazwa, inna robota); wywołujący i wywoływany.
- **Fragment:** przygotowanie requestu vs parsowanie odpowiedzi.
- **Klasa:** fałszywy limiter w teście vs prawdziwy limiter na Redisie (adapter testowy a produkcja).
- **CSS:** reguła koloru tekstu vs reguła układu flex — brak wspólnego zadania.

## Granice (rozstrzygnięte)

- Druga funkcja = pierwsza + dodatkowy warunek lub krok → `contains`, nie `pattern`.
- Ta sama operacja na innej encji (repozytorium użytkowników a repozytorium zamówień) → `pattern`. Wyjątek: to samo pole lub te same dane obsługiwane w dwóch miejscach → `same`.
- Wersja źródłowa a skompilowana tego samego kodu → `same`.
- Adapter testowy a prawdziwy → `different`.
- Etykieta wynika z definicji, nie z wyniku modelu (nie patrzeć na podobieństwo przy ocenie).

Starsza definicja EMB-01 (tylko `same` / `pattern` / `different`) została zastąpiona powyżej. Pary publiczne i `private-refs` mogą nadal używać trzech etykiet; `real-refs` (EMB-12 / CON-01) używa pięciu.

## Pliki

| Plik | Co | W gicie |
|------|----|---------|
| `families-same.mjs`, `families-pattern.mjs`, `pairs-different.mjs` | ręcznie pisany kod par publicznych | tak |
| `build-public.mjs` → `public.jsonl` | składanie par publicznych (deterministyczne) | tak |
| `private-spec.json` | pary ocenione ręcznie w DUST-15 na Monorepo-A: tylko ścieżka + nazwa symbolu | tak |
| `resolve-private.mjs` → `private-refs.jsonl` | dokładne `{repo, sha, path, startLine, endLine}` z drzewa składni przypiętej migawki + sha256 tych linii | tak — **bez kodu** |
| `real-candidates.mts` → `.tmp/…` → `real-refs.jsonl` | EMB-12 / CON: pary z Monorepo-A/Service-B dobrane po pasmach podobieństwa, ocenione ręcznie; w gicie tylko odnośniki | tak — **bez kodu** |
| `validate.mjs` | format, 5 etykiet, `larger` przy `contains`, brak kodu w odnośnikach; `--selftest` | tak |

Kod par prywatnych jest czytany dopiero w chwili pomiaru z migawki w `.tmp/targets/` (tylko lokalnie). Gdy kod pod odnośnikiem się zmienił (inny sha256), para jest pomijana i miernik o tym mówi.

`npm run emb:eval` wypisuje osobno zestaw **prawdziwy** (pary ze źródła `EMB-12 real` albo `CON-01 relabel`), obok odłożonej części `test` i całości. AP liczy pozytywy łącznie; osobno raportuje AP przy traktowaniu tylko `same`, tylko `contains`, tylko `concept` jako klasy pozytywnej.

## Zasady

- Pary publiczne są pisane ręcznie, **nie** generatorem przekształceń z EMB-04 — inaczej miarka nagradzałaby model za nauczenie się naszych własnych sztuczek.
- Dane treningowe wycinają każdą funkcję ze zbioru wzorcowego (publiczne + `private-refs` + `real-refs`) po odcisku treści — zero przecieku (`dustmap-emb/data/check_leakage.py`).
- Nowa para = edycja źródła + `node tools/emb/gold/build-public.mjs` (albo `resolve-private.mjs` / etykietowanie `real-refs`) + `npm run emb:gold`.

## Komendy

```bash
npm run emb:gold                               # walidacja zbioru
node tools/emb/gold/validate.mjs --selftest    # czy walidacja łapie podłożone wady
npm run emb:eval                               # pomiar obecnego modelu → docs/experiments/emb-results.md
npm run emb:eval -- --selftest                 # czy miernik nie kłamie (wyrocznia / los / odwrócenie)
```

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
| `harvest-same-file-siblings.mts` → `same-file-siblings-candidates.jsonl` | staging: highy „jeden plik, różne nazwy” z raportu Monorepo-A (patrz sekcja poniżej) | tak — **bez kodu** |
| `same-file-siblings-seed.jsonl` | ręcznie oceniona próbka (wejście do merge) | tak — **bez kodu** |
| `merge-same-file-siblings.mts` → `real-refs.jsonl` | wpinanie zaakceptowanych siostr do złota | tak |
| `validate.mjs` | format, 5 etykiet, `larger` przy `contains`, brak kodu w odnośnikach; `--selftest` | tak |
| `check-hygiene.mts` | CON-10: śmieć w złocie (ścieżki, dumpy, trywialne lokale); `--selftest` | tak |

Kod par prywatnych jest czytany dopiero w chwili pomiaru z migawki w `.tmp/targets/` (tylko lokalnie). Gdy kod pod odnośnikiem się zmienił (inny sha256), para jest pomijana i miernik o tym mówi.

## Higiena (CON-10)

Złoto gnije, jeśli doklejamy pary bez sensu. **Wyrzuć** (bramka `check-hygiene.mts` czerwieni):

| Powód | Przykład |
|-------|----------|
| Ścieżka poza produktem | `.claude/skills/…` |
| Dump / archiwum UI | `…/backups/…`, plik `storyboard.css` |
| Trywialne lokale jako `different` | obie strony to jedna linia w stylu `const x = null` / `new Set()` / `let n = 0` (gdy migawka da się odczytać) |
| Zdublowane id | dwa wiersze z tym samym `id` |

**Zostaw** (to nie jest śmieć):

- zagnieżdżenia EMB-10 jako `different` (helper w zakresie większej funkcji — celowy fałszywy alarm poprzedniego modelu);
- `‹private›` ↔ źródło JSX jako `same` (skompilowany DS);
- krótkie, ale **rzeczywiste** fragmenty logiki (nie same deklaracje pustych zmiennych).

### Rytuał po doleciu

Po każdym doleciu **≥ 50** nowych par do `real-refs`:

1. Wyrywkowy przegląd **≥ 30** par: krótkie fragmenty + nowe źródło (CON / EMB-10 / …).
2. Wyrzuć śmieć (albo popraw etykietę, jeśli para jest dobra).
3. Notka w `docs/experiments/emb-results.md`: ile dodano, ile wyrzucono, dlaczego.
4. `npm run emb:gold` (walidacja + higiena).

`npm run emb:eval` wypisuje osobno zestaw **prawdziwy** (pary z prawdziwego kodu: `EMB-12 real`, `CON-01 relabel`, `CON-03 real`, `EMB-10 same-file siblings` — przez `isRealSource` w `gold-data.mts`), obok odłożonej części `test` i całości. AP liczy pozytywy łącznie; osobno raportuje AP przy traktowaniu tylko `same`, tylko `contains`, tylko `concept` jako klasy pozytywnej.

## Siostry w jednym pliku (EMB-10 → złoto / CON-07)

Problem: model często łączy dwie funkcje w **tym samym pliku** o wysokim podobieństwie. To nie jest jedna klasa:

| Rodzaj | Sens dla użytkownika | Etykieta w złocie | Gdzie ląduje |
|--------|----------------------|-------------------|--------------|
| Zagnieżdżenie (helper leży w zakresie linii zewnętrznej) | fałszywy alarm raportu; produkt już pomija takie krawędzie | `different` | od razu do `real-refs` |
| Wspólny szkielet, inne zadanie / inne pole | zapach szablonu albo celowy wariant — nie scalać 1:1 | zwykle `pattern` | seed (ręcznie) albo CON-07 |
| Prawdziwa kopia do scalenia | rzadkie wśród siostr | `same` | tylko po ręcznej etykiecie |

### Potok (kolejność)

1. **Raport** na przypiętej migawce Monorepo-A (`semantic-cluster`, `high`, jeden plik, ≥2 różne nazwy).
2. **`harvest-same-file-siblings.mts`** → `same-file-siblings-candidates.jsonl`  
   - `kindHint: nested-false-alarm` + etykieta `different`  
   - `kindHint: needs-label` + propozycja `pattern` (jeszcze **nie** złoto)
3. **Ręczna próbka** → `same-file-siblings-seed.jsonl` (powód w `why`, odcisk `sha256`).
4. **`merge-same-file-siblings.mts --apply`** dopisuje do `real-refs.jsonl` tylko:
   - cały seed,
   - kandydatów `nested-false-alarm`,
   - bez duplikatów względem istniejącego złota,
   - ze `split` z `file-split.mjs` (CON-03),
   - ze `source: "EMB-10 same-file siblings"` (widoczne w `emb:eval` jako zestaw prawdziwy).
5. **`needs-label` (ok. 202 par)** zostają w candidates do etykietowania w CON-07; potem ponowny merge (opcjonalnie `--include-proposed-pattern` tylko gdy etykiety są już pewne).

Stan po pierwszym merge (22.10.2026): **+114** do `real-refs` (9 ze seed + 105 zagnieżdżeń; 4 pokrycia seed↔nested). Nadal poza złotem: **202** `needs-label`.

## Zasady

- Pary publiczne są pisane ręcznie, **nie** generatorem przekształceń z EMB-04 — inaczej miarka nagradzałaby model za nauczenie się naszych własnych sztuczek.
- Dane treningowe wycinają każdą funkcję ze zbioru wzorcowego (publiczne + `private-refs` + `real-refs`) po odcisku treści — zero przecieku (`dustmap-emb/data/check_leakage.py`).
- Nowa para = edycja źródła + `node tools/emb/gold/build-public.mjs` (albo `resolve-private.mjs` / etykietowanie `real-refs`) + `npm run emb:gold`.

## Komendy

```bash
npm run emb:gold                               # walidacja zbioru + higiena CON-10
node tools/emb/gold/validate.mjs --selftest    # czy walidacja łapie podłożone wady
npx tsx tools/emb/gold/check-hygiene.mts --selftest
npm run emb:eval                               # pomiar obecnego modelu → docs/experiments/emb-results.md
npm run emb:eval -- --selftest                 # czy miernik nie kłamie (wyrocznia / los / odwrócenie)

# Siostry w jednym pliku (raport + migawka w .tmp/targets/):
npx tsx tools/emb/gold/harvest-same-file-siblings.mts          # staging → candidates.jsonl
npx tsx tools/emb/gold/merge-same-file-siblings.mts            # dry-run: co wejdzie do złota
npx tsx tools/emb/gold/merge-same-file-siblings.mts --apply    # dopisz do real-refs.jsonl
npm run emb:gold                                               # walidacja po merge
```

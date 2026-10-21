# Zbiór wzorcowy EMB — pary funkcji z etykietą

Miarka dla każdego modelu „ten sam sens” (epik EMB). Jedna para = dwie funkcje + etykieta:

| Etykieta | Znaczy | Przykład |
|----------|--------|----------|
| `same` | ta sama logika, inny zapis | suma dodatnich: pętla / `reduce` / rekurencja |
| `pattern` | podobne z założenia, inna robota | wstęp handlera akcji, `defineAction({...})`, `try/catch` w trasie HTTP |
| `different` | inna robota | ta sama nazwa `normalize` dla tekstu i wektora; odwrotne mapowania |

`same` to klasa pozytywna, `pattern` i `different` to negatywy. Każda para ma stałą część: `validation` (~1/3 — tylko do kalibracji progów w EMB-09) albo `test` (odłożona: nigdy do treningu, nigdy do strojenia).

## Definicja: ta sama odpowiedzialność (decyzja maintainera, 21.10.2026)

> „Ta sama odpowiedzialność: rozjechane kopie też są duplikatem.”

Dwie funkcje to `same`, gdy **odpowiadają za to samo zadanie** — tak, że w jednym kodzie wystarczyłaby jedna z nich. Nie muszą dawać identycznych wyników:
- kopia z innymi literałami, nazwami, typami — `same`;
- ta sama funkcja przepisana inną składnią lub innym algorytmem — `same`;
- kopia, która się rozjechała (dodatkowy warunek, inna stała, poprawka błędu w jednej z nich) — `same`; to najcenniejsze znalezisko, bo tam siedzą błędy;
- ta sama funkcja przed i po commicie naprawiającym błąd — `same`.

`pattern` — wspólny szkielet z założenia, ale **inne zadanie**: wstęp handlera i dalej inna logika, ta sama fabryka z inną konfiguracją, rejestracja innej trasy lub zdarzenia, ten sam `switch` po innych przypadkach.

`different` — inne zadanie bez wspólnego szkieletu; także ta sama nazwa dla innej roboty i **mapowania w przeciwne strony** (A→B i B→A to dwie odpowiedzialności).

Granica `same` / `pattern`: czy po scaleniu jedna funkcja obsłużyłaby oba miejsca bez nowych parametrów, które zmieniają jej zadanie? Inna stała lub warunek → `same` (rozjechana kopia). Inna wielkość wyliczana z tych samych danych (suma vs liczba elementów, kwadraty vs sześciany) → `pattern`.

## Pliki

| Plik | Co | W gicie |
|------|----|---------|
| `families-same.mjs`, `families-pattern.mjs`, `pairs-different.mjs` | ręcznie pisany kod par publicznych | tak |
| `build-public.mjs` → `public.jsonl` | składanie par publicznych (deterministyczne) | tak |
| `private-spec.json` | pary ocenione ręcznie w DUST-15 na Monorepo-A: tylko ścieżka + nazwa symbolu | tak |
| `resolve-private.mjs` → `private-refs.jsonl` | dokładne `{repo, sha, path, startLine, endLine}` z drzewa składni przypiętej migawki + sha256 tych linii | tak — **bez kodu** |
| `real-candidates.mts` → `.tmp/…` → `real-refs.jsonl` | EMB-12: pary z Monorepo-A/Service-B dobrane po pasmach podobieństwa, ocenione ręcznie; w gicie tylko odnośniki | tak — **bez kodu** |
| `validate.mjs` | format, brak kodu w odnośnikach, minimalne liczności; `--selftest` sprawdza, że podłożone wady są łapane | tak |

Kod par prywatnych jest czytany dopiero w chwili pomiaru z migawki w `.tmp/targets/` (tylko lokalnie). Gdy kod pod odnośnikiem się zmienił (inny sha256), para jest pomijana i miernik o tym mówi.

`npm run emb:eval` wypisuje osobno zestaw **prawdziwy** (pary ze źródła `EMB-12 real`), obok odłożonej części `test` i całości.

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

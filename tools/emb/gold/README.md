# Zbiór wzorcowy EMB — pary funkcji z etykietą

Miarka dla każdego modelu „ten sam sens” (epik EMB). Jedna para = dwie funkcje + etykieta:

| Etykieta | Znaczy | Przykład |
|----------|--------|----------|
| `same` | ta sama logika, inny zapis | suma dodatnich: pętla / `reduce` / rekurencja |
| `pattern` | podobne z założenia, inna robota | wstęp handlera akcji, `defineAction({...})`, `try/catch` w trasie HTTP |
| `different` | inna robota | ta sama nazwa `normalize` dla tekstu i wektora; odwrotne mapowania |

`same` to klasa pozytywna, `pattern` i `different` to negatywy. Każda para ma stałą część: `validation` (~1/3 — tylko do kalibracji progów w EMB-09) albo `test` (odłożona: nigdy do treningu, nigdy do strojenia).

## Pliki

| Plik | Co | W gicie |
|------|----|---------|
| `families-same.mjs`, `families-pattern.mjs`, `pairs-different.mjs` | ręcznie pisany kod par publicznych | tak |
| `build-public.mjs` → `public.jsonl` | składanie par publicznych (deterministyczne) | tak |
| `private-spec.json` | pary ocenione ręcznie w DUST-15 na Monorepo-A: tylko ścieżka + nazwa symbolu | tak |
| `resolve-private.mjs` → `private-refs.jsonl` | dokładne `{repo, sha, path, startLine, endLine}` z drzewa składni przypiętej migawki + sha256 tych linii | tak — **bez kodu** |
| `validate.mjs` | format, brak kodu w odnośnikach, minimalne liczności; `--selftest` sprawdza, że podłożone wady są łapane | tak |

Kod par prywatnych jest czytany dopiero w chwili pomiaru z migawki w `.tmp/targets/` (tylko lokalnie). Gdy kod pod odnośnikiem się zmienił (inny sha256), para jest pomijana i miernik o tym mówi.

## Zasady

- Pary publiczne są pisane ręcznie, **nie** generatorem przekształceń z EMB-04 — inaczej miarka nagradzałaby model za nauczenie się naszych własnych sztuczek.
- Dane treningowe (EMB-04/05) wycinają każdą funkcję ze zbioru wzorcowego po odcisku treści (zero przecieku).
- Nowa para = edycja źródła + `node tools/emb/gold/build-public.mjs` (albo `resolve-private.mjs`) + `npm run emb:gold`.

## Komendy

```bash
npm run emb:gold                               # walidacja zbioru
node tools/emb/gold/validate.mjs --selftest    # czy walidacja łapie podłożone wady
npm run emb:eval                               # pomiar obecnego modelu → docs/experiments/emb-results.md
npm run emb:eval -- --selftest                 # czy miernik nie kłamie (wyrocznia / los / odwrócenie)
```

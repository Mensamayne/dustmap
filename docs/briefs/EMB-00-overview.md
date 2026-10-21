# EMB-00 — Własny lokalny model embeddingowy dla „ten sam sens, inny kod”

**Queue:** `EMB-00` | **Epic:** EMB | **Segment:** semantic | **Layer:** 0

## Overview

Dustmap ma znajdować funkcje, które robią to samo, choć są napisane inaczej (pętla vs `reduce`, dwa parsery tej samej wiadomości). Dziś to obiecuje, ale nie umie — co pokazały liczby z 20.10.2026. Epik daje własny, mały model uruchamiany lokalnie (bez sieci), który rozpoznaje sens kodu, odróżnia go od „wzorca” (podobne wstępy handlerów) i liczy szybko na zwykłym CPU. Na końcu Dustmap sam liczy wektory i grupy; ścieżka `jscpd --semantic` znika.

## Stan wyjściowy (pomiar, nie opinia)

| Co | Liczba | Źródło |
|----|--------|--------|
| Ta sama logika, inny zapis (lab `03`) | podobieństwo 0,66 / 0,68 / 0,75 / 0,80 → **żadna para nad progiem 0,82** | `../dustmap-lab/results/LAB.md` |
| Bliźniaki różniące się nazwą i jednym napisem | 0,804 (poniżej progu) | lab `03` |
| Wersja rekurencyjna sumy | brak pary w ogóle | lab `03` |
| jscpd zwraca tylko część par (3 te same pętle → 1 para) | — | lab `03` |
| Trafność ≥ 0,85 na Monorepo-A (głównie kopie z innymi literałami) | 6/8 | DUST-15 |
| Szybkość na CPU (16 wątków) | 1,3–2,1 funkcji/s → pełny Monorepo-A ~2 h | DUST-15 |
| Sprzęt | RTX 4070 Ti 12 GB; PyTorch zainstalowany tylko CPU; wolne: C: 67 GB (97% zajęte), D: 151 GB, **E: 413 GB** | 21.10.2026 |
| Obecny model na dysku | `jina-embeddings-v2-base-code`, `model.safetensors` 310 MB w pamięci jscpd (`%LOCALAPPDATA%/jscpd/cache/models`) | 21.10.2026 |
| Po naprawie BUG-07 | etykiety i odciski grup „po sensie” poprawne; luka modelu bez zmian (lab `03`: 6 × 🟡 EMB) | 21.10.2026 |

## Binding (decyzje epiku)

- **Najpierw miara, potem model.** Żaden trening przed zbiorem wzorcowym i wynikiem bazowym (EMB-01). Każda zmiana modelu = liczby na tym samym zbiorze.
- **Lokalnie.** Trening i działanie na tym komputerze; zero wysyłki kodu. Każde pobranie (wagi, CUDA, paczki) tylko po jawnej zgodzie maintainera (EMB-02).
- **Dwa modele, nigdy jeden „do wszystkiego”:** *prywatny* (dane z repo maintainera, tylko do użytku lokalnego, **nigdy nie publikowany** — model może zapamiętać kod) i *publiczny* (tylko dane syntetyczne + kod o wolnej licencji; ten trafia do użytkowników).
- **Mały i szybki:** model ≤ ~150 M parametrów; produkt ONNX int8 ≤ 150 MB; cel ≥ 50 funkcji/s na CPU 16 wątków (dziś ~2), GPU opcjonalny.
- **Cele jakości (zbiór wzorcowy, odłożony):** precyzja ≥ 0,90 dla `real` nad progiem raportu; ≥ 70% par „ten sam sens” wykrytych; ≥ 80% par `pattern` poniżej progu; lab `03` cały zielony.
- **Licencja:** model bazowy i zależności tylko MIT / Apache-2.0 / BSD (bramka licencji z DUST-12 obejmuje nowe paczki).
- **Prywatność zbioru wzorcowego:** pary z prywatnych repo zapisane jako odnośniki (repo, commit, plik, linie) + etykieta; treść kodu czytana lokalnie w chwili pomiaru, nigdy nie w gicie.
- **Gdzie co leży:** pomiar i integracja w tym repo (`tools/emb/`, `packages/core/src/semantic/`); trening (Python) w osobnym repo `../dustmap-emb` (artefakty poza gitem, ciężkie na dysku wskazanym w EMB-02 — propozycja E:); limit dysku epiku ≤ 25 GB.
- **Lista do usunięcia:** gdy EMB-10 uzna nowy dostawcę za domyślny — `packages/core/src/semantic/jscpd-semantic.ts` i ścieżka `provider: local` przez jscpd znikają w tym samym epiku.

## Epic plan

| ID | Outcome |
|----|---------|
| EMB-00 | Ten overview |
| EMB-01 | Zbiór wzorcowy par + miernik + wynik bazowy obecnego modelu |
| EMB-02 | Środowisko treningowe i zgody (CUDA, wagi, dysk, `../dustmap-emb`) |
| EMB-03 | Wybór modelu bazowego: 3–4 kandydatów bez douczania na zbiorze wzorcowym |
| EMB-04 | Dane: pary „ten sam sens” (historia git, przekształcenia składni bez zmiany sensu) |
| EMB-05 | Dane: trudne negatywy i wzorce (wstępy handlerów, ta sama nazwa / inna logika, poprawki zmieniające zachowanie) |
| EMB-06 | Trening kontrastowy: model prywatny i publiczny |
| EMB-07 | Eksport ONNX + int8, zgodność z oryginałem, szybkość |
| EMB-08 | Dostawca `onnx` w Dustmapie: wycinanie funkcji z drzewa składni TS, wszystkie pary, grupy po parze plików |
| EMB-09 | Kalibracja: próg → pewność, obniżanie wzorców |
| EMB-12 | Domknięcie zestawu testowego: pary z prawdziwego kodu, trening ich nie widzi, miernik raportuje je osobno |
| EMB-13 | Dane treningowe wg definicji odpowiedzialności: mniej rewrite, fix = duplikat, bez mutantów i bliźniaków algorytmów, spójność etykiet |
| EMB-14 | Trening z oceną par + pojedynek dwóch baz na 10% danych (wybór po wyniku na prawdziwym kodzie) |
| EMB-15 | Pełny trening, paczka ONNX, kalibracja progów |
| EMB-10 | Pomiar na Monorepo-A, Service-B i labie; decyzja o domyślnym; usunięcie ścieżki jscpd |
| EMB-11 | Dystrybucja modelu publicznego (wstrzymane: najpierw tylko model prywatny) |

Kolejność: EMB-01 i EMB-02 równolegle → EMB-03 → EMB-04 i EMB-05 równolegle → EMB-06 → EMB-07 → EMB-08 → EMB-09 → EMB-12 → EMB-13 → EMB-14 → EMB-15 → EMB-10 → EMB-11. EMB-08 czeka też na BUG-07.

**Korekta po EMB-09 (21.10.2026):** brief „sztuczne bliźniaki algorytmów + mutanty” anulowany. Definicja etykiet: `tools/emb/gold/README.md`. Priorytet: model prywatny; publiczny olewamy aż maintainer powie inaczej.

## Constraints

- Dustmap nadal report-only; model nie wprowadza żadnego zapisu poza `outputDir` (cache wektorów) i katalogiem modeli użytkownika
- Domyślnie zero sieci; pobranie modelu tylko jawną komendą
- Żadnych wag ani danych prywatnych w tym repo

## Pliki (scope)

- `docs/briefs/EMB-*.md`, `docs/briefs/queue.json`, `docs/briefs/README.md`

## Weryfikacja

```bash
npm run queue:validate
```

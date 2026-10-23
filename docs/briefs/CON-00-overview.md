# CON-00 — Overview: dane do łapania powielonych koncepcji (v1)

**Queue:** `CON-00` | **Epic:** CON | **Segment:** semantic | **Layer:** 0

## Po co

Model z epiku EMB łapie dwie funkcje z tą samą odpowiedzialnością. Maintainer chce więcej (22.10.2026): po wrzuceniu repo Dustmap ma pokazać, **gdzie powiela się koncepcja**. Dotyczy to nie tylko kopii funkcji, ale też:

1. **Ta sama robota zrobiona inaczej:** funkcja w pliku A robi X, funkcja w pliku B robi X innym sposobem.
2. **Rozbudowana wersja:** dwie prawie identyczne funkcje, z których jedna jest bardziej rozbudowana. Mniejsza jest zawarta w większej.
3. **Kawałek w środku:** fragment długiej funkcji robi to samo, co inna funkcja albo inny fragment.
4. **Klasy:** dwie klasy robią mniej więcej to samo, z innymi nazwami i trochę innymi metodami.
5. **Reguły CSS:** te same deklaracje pod innymi selektorami albo zapisane inaczej (skrót a pełny zapis).
6. **Koncepcja rozłożona inaczej:** ten sam pomysł zrobiony jako jedna długa funkcja w jednym miejscu, a jako trzy pomocnicze w innym.

Model uczy się wyłącznie z danych. Ten epik buduje **dane, miarę i model v2**: definicję z przykładami, wspólne cięcie kodu, zestaw testowy, zbiór treningowy, trening prywatnego modelu na tych danych (CON-11) oraz porównanie z modelem z EMB-15. Wpięcie nowych kształtów znalezisk do raportu Dustmapa to osobny epik (Skan v2).

## Zakres v1 i to, co później

- **v1 (ten epik, do CON-11 włącznie):** znaleźć powielone koncepcje i redundancję (dane + model), z dowodem: które miejsca, które linie, jak bardzo podobne, kto zawiera kogo; mieć zmierzony model v2 względem EMB-15.
- **Później (osobny epik produktu):** ocena „czy da się scalić i ile to da”, np. „x pokrywa zachowanie y poza tymi różnicami; y ma 500 linii i 8 testów”. Tego model sensu sam nie policzy. To robi agent albo lokalny model językowy na kandydatach z v1. Dane pomocnicze zbieramy już tutaj tanim kosztem (CON-05: commity scalające, ile linii i testów zniknęło), ale ich tu nie używamy.
- **Reguła produktu bez zmian:** znalezisko mówi *gdzie i jaki dowód*, nie *jak przerobić*. Wersja „dopisz 3 linie do x” wymagałaby decyzji maintainera o zmianie tej reguły. Poza zakresem.

## Definicja (wiążąca dla wszystkich briefów)

Etykieta pary kawałków kodu (A, B):

| Etykieta | Znaczenie | Dla modelu |
|---|---|---|
| `same` | ta sama odpowiedzialność: kopia, rozjechana kopia, inny algorytm, inna stała lub warunek, przed i po poprawce | pozytyw |
| `contains` | jeden jest rozbudowaną wersją drugiego albo zawiera go jako fragment; mniejszy da się wyrzucić na rzecz większego | pozytyw (asymetryczny: zapisujemy, kto jest większy) |
| `concept` | ta sama koncepcja w innym kształcie: inny podział na funkcje, klasa a zbiór funkcji, dwie klasy z pokrywającymi się metodami | pozytyw (słabszy) |
| `pattern` | wspólny szkielet, inne zadanie; to samo działanie na innym polu lub innej wielkości z tych samych danych (suma a liczba, pole A a pole B) | negatyw (trudny) |
| `different` | inne zadanie; wywołujący i wywoływany; odwrotność (zapis a odczyt); ta sama nazwa, inna robota | negatyw |

Granice, które wracają najczęściej (rozstrzygnięte):

- Druga funkcja = pierwsza + dodatkowy warunek lub krok → `contains`, nie `pattern`.
- Ta sama operacja na innej encji (repozytorium użytkowników a repozytorium zamówień) → `pattern`. Wyjątek: to samo pole lub te same dane obsługiwane w dwóch miejscach → `same`.
- Wersja źródłowa a skompilowana tego samego kodu → `same`.
- Adapter testowy a prawdziwy (fałszywy limiter a limiter na Redisie) → `different`.

## Jednostki (co porównujemy)

Funkcja, **fragment** (spójny ciąg instrukcji wewnątrz długiej funkcji, cięty po granicach instrukcji), **klasa** (całość plus lista jej metod), **reguła CSS** (selektor + deklaracje; także w CSS-in-JS, gdy jest literałem). Dane i skan tną kod **tym samym kodem** (CON-02). Inaczej model uczy się na kawałkach, których skan nigdy nie zobaczy.

## Briefy

| ID | Co | Gates |
|----|----|----|
| CON-01 | Definicja z przykładami + nowa ocena 241 par | CON-00 |
| CON-02 | Wspólne cięcie: fragmenty, klasy, reguły CSS | CON-00 |
| CON-03 | Zestaw testowy v2 (≥ 800 par, wszystkie jednostki, dwóch oceniających) | CON-01, CON-02 |
| CON-04 | Korpus: kod do nauki (prywatne cele + otwarte repo na wolnych licencjach) | CON-02 |
| CON-05 | Pary z historii gita: wzrost funkcji, wydzielenie, scalenie, przeniesienie | CON-04 |
| CON-06 | Pary generowane: rozbudowa, rozkład, klasy, CSS | CON-04 |
| CON-07 | Trudne negatywy dla koncepcji | CON-04 |
| CON-08 | Bramki: spójność etykiet, przeciek, bilans, karta danych | CON-03, CON-05, CON-06, CON-07 |
| CON-09 | Paczka danych + pomiar bazowy obecnego modelu na zestawie v2 | CON-08, EMB-15 |
| CON-10 | Szlifowanie i pielęgnacja zbioru wzorcowego | CON-03 |
| CON-11 | Trening modelu v2 na nowych danych + porównanie z EMB-15 | CON-09 |

Kolejność pracy: CON-01 i CON-02 równolegle, potem CON-03 i CON-04, CON-10 (higiena) może iść zaraz po CON-03; potem CON-05, CON-06 i CON-07 (niezależne), potem CON-08 i CON-09, na koniec **CON-11** (trening v2 i badanie względem poprzedniego modelu).

## Twarde zasady

- **Prywatny kod nigdy nie trafia do gita** ani poza ten komputer. W gicie są tylko odnośniki (repo, commit, plik, linie, sha256). Wysyłanie prywatnego kodu do zewnętrznego API jest zabronione. Generowanie (CON-06) i drugi oceniający (CON-03) działają lokalnie albo tylko na kodzie publicznym.
- Cele (Monorepo-A, Service-B) są **tylko do odczytu**: przypięte migawki (`git archive`) w `.tmp/targets/`, żadnych zapisów ani uruchamiania ich skryptów.
- Pobrania (repo, modele): zgoda ogólna maintainera. Każde pobranie trafia do `docs/experiments/emb-results.md` z wersją i licencją. Licencje MIT / Apache-2.0 / BSD. Wagi wyłącznie safetensors. `trust_remote_code` dopiero po przeglądzie kodu.
- Pracujemy tylko nad wariantem prywatnym modelu. Publiczny czeka na decyzję maintainera.
- Żadna funkcja ani fragment z zestawu testowego nie może trafić do treningu, także jako fragment większego kawałka (bramka CON-08).
- Bez ręcznie prowadzonych list wyjątków. Reguła, której nie da się zapisać ogólnie, nie wchodzi.
- **Uczenie wag tylko na GPU (CUDA)** — jak w EMB (`docs/experiments/emb-env.md`). Brak karty = stop; zakaz treningu na CPU.

## Wynik epiku (23.10.2026)

- **Dane:** korpus CON-04…07, bramki CON-08 zielone, prywatny zbiór przypięty (`pin.json`, CON-09).
- **Baza EMB-15 na złocie v2 (CON-09):** AP test **0,499**; same 0,467 · contains **0,051** · concept **0,030**. CSS: 102 pary poza migawką.
- **CON-11:** douczanie na danych CON nie przebija EMB-15 (apRealVal ~0,33 vs start). **Domyślny prywatny = nadal EMB-15.** Epik CON (dane + pomiar + próba v2) domknięty; Skan v2 może iść na EMB-15 albo czekać na lepszy przepis treningu.

## Gotowe, gdy

- Zestaw testowy v2 mierzy każdą jednostkę i każdą etykietę osobno, a obecny model (EMB-15) ma na nim zmierzony wynik bazowy (CON-09).
- Zbiór treningowy pokrywa wszystkie pięć etykiet i cztery jednostki, w proporcjach zapisanych w karcie danych, z zerową liczbą sprzeczności i przecieków.
- Model v2 jest wytrenowany na tych danych i **porównany z EMB-15** na tym samym zestawie (CON-11); decyzja „nowy domyślny / jeszcze nie” jest zapisana liczbami.
- Epik Skan v2 (produkt) może ruszyć bez pytań o dane ani o to, który model prywatny brać.

## Następne epiki (poza zakresem CON)

- **Skan v2:** w Dustmapie nowe kształty znalezisk („zawarta w”, „równoległe klasy”, „powielona reguła CSS”), szybki wstępny wybór kandydatów zamiast porównania wszystkiego ze wszystkim (fragmenty mnożą liczbę jednostek); podpięcie modelu z CON-11.
- **v2 produktu:** ocena scalenia (agent albo lokalny model językowy).

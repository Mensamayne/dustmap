# Briefy — indeks

Statusy **tylko** w [queue.json](queue.json). Jak pracować z kolejką: [../QUEUE.md](../QUEUE.md). Gdzie testować: [../TEST-TARGETS.md](../TEST-TARGETS.md).

**Epik DUST — Dustmap v1** (skan całego repo albo zmian → jeden raport; martwy kod, duplikaty po tekście i sensie, sygnały do przebudowy; nigdy nie zmienia kodu). Overview: [DUST-00-overview.md](DUST-00-overview.md).

| ID | Co |
|----|----|
| DUST-00 | Overview + szkielet repo |
| DUST-01 | Kontrakt raportu v1 |
| DUST-02 | Rdzeń: config, init, full/diff, cache |
| DUST-03–05 | Knip / jscpd / embeddingi |
| DUST-06–08 | Sygnały: kod / git / struktura |
| DUST-09 | Ranking, decyzje, zapadka |
| DUST-10–12 | CLI / MCP / GitHub Action + izolacja |
| DUST-13 | Wtyczka: znaleziska → briefy w kolejce |
| DUST-14 | Sędzia LLM (opcja) |
| DUST-15 | Pomiar embeddingów na Monorepo-A |
| DUST-16 | Cele testowe + zbiór prawdy |
| DUST-17 | Agent wpięty: playbook, init --agent |
| DUST-18 | Próba prawdziwego agenta na Monorepo-A |
| DUST-19 | Pierwsza komenda: dustmap scan + summary (zaraz po DUST-03) |
| BUG-01 | Skan bierze pliki ignorowane przez git; punkty wejścia z dist/ |
| DUST-20 | Rola każdego pliku: co jest naprawdę kodem |
| DUST-21 | Filtr pewności w `dustmap_list` |
| BUG-02 | `stale: false` gdy brak HEAD |
| BUG-03 | Skan diff kasuje całą mapę; odświeżenie od złej bazy |
| BUG-04 | `dustmap_scan` zawsze odpowiada „aktualny” |
| BUG-05 | Harness żywego agenta: `--bare`, brak oceny, brudna migawka |
| DUST-22 | `dustmap list` w CLI — pętla bez MCP |
| DUST-23 | Żywy agent na migawce Monorepo-A (wymaga `claude auth login`) |
| BUG-06 | Dane testowe (fixtures) jako martwy kod high |
| BUG-07 | Para po sensie: druga strona z nazwą i treścią pierwszej |
| BUG-08 | Odcisk martwego kodu z samej nazwy — decyzje nie wygasają |
| BUG-09 | `summary` ocenia świeżość względem bieżącego katalogu |
| BUG-10 | `unused-dependency` high bez zainstalowanych paczek |
| BUG-11 | Zła baza `scan --diff` → kod 1 |
| BUG-12 | Monorepo: punkty wejścia nie docierają do paczek |
| DUST-24 | Posprzątać kurz znaleziony w samym Dustmapie |

**Epik EMB — własny lokalny model embeddingowy** („ten sam sens, inny kod”). Overview: [EMB-00-overview.md](EMB-00-overview.md).

| ID | Co |
|----|----|
| EMB-00 | Overview, stan wyjściowy z pomiarów, decyzje |
| EMB-01 | Zbiór wzorcowy par + miernik + wynik bazowy |
| EMB-02 | Środowisko treningowe i zgody (CUDA, wagi, dysk) |
| EMB-03 | Wybór modelu bazowego (liczby, licencje) |
| EMB-04–05 | Dane: pary „ten sam sens”, trudne negatywy i wzorce |
| EMB-06 | Trening: model prywatny i publiczny |
| EMB-07 | Eksport ONNX + int8 |
| EMB-08 | Dostawca `onnx` w Dustmapie |
| EMB-09 | Kalibracja progów i pewności |
| EMB-12 | Domknięcie zestawu testowego (prawdziwy kod w mierniku) |
| EMB-13 | Przebudowa danych treningowych wg definicji odpowiedzialności |
| EMB-14 | Trening z oceną par + pojedynek baz |
| EMB-15 | Pełny trening, paczka ONNX, kalibracja |
| EMB-10 | Pomiar na celach, decyzja o domyślnym, usunięcie ścieżki jscpd |
| EMB-11 | Dystrybucja modelu publicznego (wstrzymane) |

**Epik CON — dane do łapania powielonych koncepcji (v1)** (rozbudowane wersje, fragmenty, klasy, reguły CSS, koncepcje rozłożone inaczej; tylko dane i miara, trening osobno). Overview: [CON-00-overview.md](CON-00-overview.md).

| ID | Co |
|----|----|
| CON-00 | Overview: definicja pięciu etykiet, jednostki, zasady |
| CON-01 | Definicja z przykładami + nowa ocena 241 par |
| CON-02 | Wspólne cięcie kodu: fragmenty, klasy, reguły CSS (dane = skan) |
| CON-03 | Zestaw testowy v2: ≥ 800 par, dwóch oceniających |
| CON-04 | Korpus: prywatne cele + otwarte repo na wolnych licencjach |
| CON-05 | Pary z historii gita: wzrost, wydzielenie, scalenie, przeniesienie |
| CON-06 | Pary generowane lokalnie z kontrolą, że operacja zaszła |
| CON-07 | Trudne negatywy dla koncepcji |
| CON-08 | Bramki: spójność, przeciek, bilans, karta danych |
| CON-09 | Paczka danych + pomiar bazowy obecnego modelu |
| CON-10 | Szlifowanie i pielęgnacja zbioru wzorcowego (śmieć out, rytuał) |

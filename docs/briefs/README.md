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
| BUG-03 | Skan diff kasuje całą mapę; odświeżenie od złej bazy (czeka na decyzję) |
| BUG-04 | `dustmap_scan` zawsze odpowiada „aktualny” |
| BUG-05 | Harness żywego agenta: `--bare`, brak oceny, brudna migawka |
| DUST-22 | `dustmap list` w CLI — pętla bez MCP |
| DUST-23 | Żywy agent na migawce Monorepo-A (wymaga `claude auth login`) |

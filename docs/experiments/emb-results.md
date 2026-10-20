# Wyniki: „ten sam sens” na zbiorze wzorcowym (EMB)

Każdy wiersz to jeden przebieg `npm run emb:eval` na zbiorze z `tools/emb/gold` (EMB-01). **same** = ta sama logika (klasa pozytywna); **pattern** i **different** = negatywy. Główna liczba to **AP** (średnia precyzja rankingu: 1,0 = wszystkie pary `same` nad wszystkimi pozostałymi; los ≈ odsetek par `same`). „Brak wyniku” = dostawca w ogóle nie połączył pary (liczone jako 0). Zbiór `test` jest odłożony — nie trenujemy ani nie stroimy na nim progów.

## Wynik bazowy (21.10.2026, EMB-01)

Obecna droga produktu (jscpd `--semantic`, model `jina-embeddings-v2-base-code`), każda para mierzona osobno:

- **Model nie odróżnia „robi to samo” od „wygląda podobnie”.** Średnie podobieństwo par `same` (0,44) jest takie samo jak par `pattern` (0,45). Ranking jest niewiele lepszy od losu: AP 0,53 przy losie ~0,39.
- **Przy dzisiejszym progu 0,82 Dustmap znajduje 7% par „ten sam sens”** (zbiór `test`), z precyzją 60%. Ręcznie pisane pary z naprawdę innym zapisem (pętla vs `reduce`, klasa vs domknięcie) dostają 0,35–0,76 — wszystkie pod progiem.
- **Pary nad progiem to głównie przypadki z Monorepo-A**, gdzie dwie funkcje są kopią z innymi literałami (0,79–0,96). Najwyżej ocenione negatywy to też Monorepo-A: dwa adaptery jednego portu (0,96, `pattern`), wstępy handlerów (0,83–0,84) i odwrotne mapowania zgody (0,85).
- **42 ze 165 par nie dostało żadnego wyniku** — jscpd nie wyciął z nich jednostki (najczęściej krótkie funkcje strzałkowe i kod w wywołaniach `router.get(...)`, `bus.on(...)`). To też jest zachowanie produktu: takie duplikaty dziś są niewidoczne.
- Najlepszy możliwy próg dla tego modelu to 0,545 (F1 0,62) — ale wtedy przechodzi też większość wzorców. Strojenie progu nie naprawi braku rozróżnienia; potrzebny jest inny model (EMB-03 → EMB-06).

Surowe wyniki (tylko identyfikatory par i liczby, bez kodu): `.tmp/emb/run-*.json`.

## Przebiegi

| Data | Dostawca / model | Zbiór | Par | AP | Precyzja @próg | Wykrywalność @próg | `pattern` pod progiem | Najlepszy próg (F1) | Brak wyniku | Śr. same / pattern / different | Czas | Rozmiar modelu | Uwagi |
|---|---|---|--:|--:|--:|--:|--:|---|--:|---|--:|--:|---|
| 2026-10-21 | obecny: jscpd --semantic · jina-embeddings-v2-base-code | test | 113 | 0.528 | 0.600 | 0.070 | 0.950 | 0.545 (F1 0.62) | 29 | 0.44 / 0.45 / 0.20 | 138 s | 309 MB | wynik bazowy EMB-01 |
| 2026-10-21 | obecny: jscpd --semantic · jina-embeddings-v2-base-code | całość | 165 | 0.536 | 0.600 | 0.092 | 0.946 | 0.545 (F1 0.64) | 42 | 0.47 / 0.47 / 0.21 | 138 s | 309 MB | wynik bazowy EMB-01 |

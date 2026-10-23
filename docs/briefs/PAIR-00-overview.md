# PAIR-00 — Overview: osobna decyzja na parach (ten sam enkoder)

**Queue:** `PAIR-00` | **Epic:** PAIR | **Segment:** semantic | **Layer:** 0

## Po co

Epik CON pokazał, że douczenie całego enkodera na bogatszych danych **nie** przebija EMB-15 na złocie, a miękkie etykiety (`contains`, `concept`) siedzą koło zera. Produkt myli kopie z wzorcami (ten sam szkielet, inne zadanie).

Ten epik **zostawia enkoder EMB-15** i dokłada **małą głowę na parach**: `same` | `pattern` | `other`. Raport „ten sam sens” ma raportować głównie twarde kopie; wzorce ciszej albo poza high.

## Decyzje wiążące

- Backbone: paczka prywatna EMB-15 (`dustmap-same-meaning-private`), bez większej sieci.
- Głowa: wejście z wektorów pary (cechy `[a; b; |a−b|; a⊙b]`), wyjście 3 klasy.
- Soft etykiety (`contains`, `concept`) → klasa `other` (nie „raportuj jako kopię”).
- Uczenie wag **tylko GPU (CUDA)** — `docs/experiments/emb-env.md`.
- Prywatny kod nie wychodzi z maszyny; wagi prywatne poza gitem.

## Briefy

| ID | Co | Gates |
|----|----|-------|
| PAIR-00 | Ten overview | — |
| PAIR-01 | Kontrakt klas + miernik na złocie v2 (osobno od samego cosinusa) | PAIR-00 |
| PAIR-02 | Trening głowy na GPU | PAIR-01 |
| PAIR-03 | Paczka ONNX (enkoder + pairHead + progi) | PAIR-02 |
| PAIR-04 | Wpięcie w skan semantic | PAIR-03 |
| PAIR-05 | Porównanie Monorepo-A EMB-15 vs PAIR + werdykt domyślnego | PAIR-04 |

## Poza zakresem

- Większy enkoder; pełne douczanie CON od zera.
- Nowe kształty znalezisk „zawarta w” / CSS (**Skan v2**).
- Dystrybucja publicznej paczki (EMB-11).

## Gotowe, gdy

- Miernik PAIR na teście złota v2 rozróżnia `same` vs `pattern` lepiej niż sam cosinus (albo uczciwy werdykt „nie”).
- Paczka z głową przechodzi `verify_package` / load w Dustmapie.
- Skan na tej samej migawce Monorepo-A ma tabelę EMB-15 vs PAIR i jednozdaniowy werdykt domyślnego modelu.

## Wynik epiku (23.10.2026)

- Paczka `dustmap-same-meaning-private-pair` v0.5.0-pair (enkoder EMB-15 + `pair_head.onnx`).
- Test złota: same-AP 0,53 / precyzja same 0,62 vs cosinus 0,49 / 0,31.
- Monorepo-A: semantic 783 (high 118) vs EMB-15 1034 (high 603).
- **Domyślny produkt: nadal EMB-15**; PAIR opcjonalny do kalibracji pasm pod P(same).

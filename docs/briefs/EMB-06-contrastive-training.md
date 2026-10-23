# EMB-06 — Trening: model prywatny i publiczny

**Queue:** `EMB-06` | **Epic:** EMB | **Segment:** semantic | **Layer:** 6

## Overview

Model bazowy z EMB-03 douczony kontrastowo (pary „ten sam sens” przyciągane, wzorce i różne funkcje odpychane). Dwa przebiegi: **prywatny** (wszystkie dane, do użytku tylko na tym komputerze) i **publiczny** (tylko dane syntetyczne i o wolnej licencji — ten może trafić do ludzi). Każdy przebieg kończy się liczbą na zbiorze wzorcowym.

## Plan

### Step 1 — Przepis treningu

- **Plik:** `../dustmap-emb/train.py`, `../dustmap-emb/configs/*.yaml`
- **Zmiana:** strata kontrastowa z negatywami z batcha + trudnymi negatywami (EMB-05); stałe ziarno; zapis konfiguracji, wersji danych i sumy kontrolnej bazowego modelu przy każdym checkpoincie; mieści się w 12 GB VRAM (mieszana precyzja, akumulacja gradientu)
- **Done when:** 1 epoka na 10% danych działa i poprawia miernik względem bazowego

### Step 2 — Przebiegi

- **Plik:** `docs/experiments/emb-results.md`
- **Zmiana:** prywatny i publiczny: krzywa uczenia, wynik na zbiorze wzorcowym (osobno pary prywatne i publiczne), czas treningu
- **Done when:** model publiczny spełnia cele jakości z EMB-00 albo raport mówi uczciwie, czego brakuje i dlaczego

### Step 3 — Kontrola zapamiętywania (model publiczny)

- **Plik:** `../dustmap-emb/memorization_check.py`
- **Zmiana:** potwierdzenie, że model publiczny nie widział danych prywatnych (manifest danych + sumy kontrolne)
- **Done when:** manifest dołączony do checkpointu publicznego

## Constraints

- Uczenie wag **tylko na GPU (CUDA)**; brak karty = stop (`train.py` / `smoke.py`). Zakaz ścieżki CPU.

- Model prywatny nigdy nie opuszcza tego komputera (nie trafia do gita, wydań ani rejestrów)
- Dysk: checkpointy rotowane, łącznie w budżecie z EMB-02

## Pliki (scope)

- `../dustmap-emb/**`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
python ../dustmap-emb/train.py --config configs/public.yaml
npm run emb:eval -- --provider http --url http://127.0.0.1:<port>/v1
```

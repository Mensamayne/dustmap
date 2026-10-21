# EMB-14 — Trening z oceną par + pojedynek baz

**Queue:** `EMB-14` | **Epic:** EMB | **Segment:** semantic | **Layer:** 10

## Overview

Model uczy się nie tylko „kotwica bliżej pozytywu niż negatywów”, ale też oceniać pary (ranking / wynik podobieństwa zgodny z etykietą). Najpierw krótki pojedynek dwóch baz na 10% danych: obecny UniXcoder i jeden większy model z wolną licencją. Zwycięzca idzie do pełnego treningu w EMB-15; wybór po wyniku na prawdziwym kodzie (zestaw z EMB-12), nie po wewnętrznej walidacji treningu.

## Read first

1. `docs/briefs/EMB-03-base-model-choice.md` — wcześniejszy ranking baz
2. `docs/briefs/EMB-06-contrastive-training.md` — obecna strata
3. `tools/emb/gold/README.md` — definicja etykiet

## Plan

### Step 1 — Strata / głowa oceny par

- **Plik:** `../dustmap-emb/train.py`, `../dustmap-emb/configs/*.yaml`
- **Zmiana:** obok kontrastu uczenie oceny pary (np. korelacja / rankingowa strata na podobieństwie vs etykieta); checkpoint wybierany po AP na prawdziwym kodzie (split test złota, źródło real), nie po stratach batcha
- **Done when:** konfiguracja i kod treningu to robią; krótki przebieg na 10% dowodzi, że selekcja patrzy na real

### Step 2 — Pojedynek baz (10% danych)

- **Plik:** `../dustmap-emb/configs/*.yaml`, `docs/experiments/emb-results.md`
- **Zmiana:** ten sam przepis, 10% danych, dwie bazy: obecna (`microsoft/unixcoder-base`) i jeden większy kandydat wyłącznie MIT/Apache-2.0/BSD (≤ ~150 M jeśli da się; jeśli większy — uzasadnić w wynikach względem limitu produktu). Pomiar: AP test + AP prawdziwy kod.
- **Done when:** tabela w `emb-results.md`; decyzja która baza idzie do EMB-15

## Constraints

- Licencja bazy: tylko MIT / Apache-2.0 / BSD
- Pobranie wag tylko po wcześniejszej zgodzie maintainera (jak EMB-02); jeśli brak zgody na drugą bazę → stop `blocked` z powodem
- Bez strojenia progów pod część testową złota

## Pliki (scope)

- `../dustmap-emb/train.py`, `../dustmap-emb/configs/**`, `../dustmap-emb/encoders.py`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
# pojedynek 10% — komendy z README dustmap-emb po Step 1
npm run emb:eval -- --provider http --url <loopback> --model <trial-a>
npm run emb:eval -- --provider http --url <loopback> --model <trial-b>
```

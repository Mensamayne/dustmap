# CON-01 — Definicja z przykładami i nowa ocena 241 par

**Queue:** `CON-01` | **Epic:** CON | **Segment:** semantic | **Layer:** 1

## Overview

Każdy, kto ocenia pary (człowiek, agent, drugi model), stosuje tę samą definicję pięciu etykiet z CON-00. Definicja ma rozstrzygnięte przykłady dla każdej jednostki. 241 par z EMB-12 jest oceniona na nowo według niej: rozbudowane wersje oznaczone wcześniej jako `pattern` przechodzą na `contains`.

## Read first

1. `docs/briefs/CON-00-overview.md` — tabela etykiet i granice
2. `tools/emb/gold/README.md` — obecna definicja (3 etykiety)
3. `tools/emb/gold/real-refs.jsonl` — 241 par, odnośniki bez kodu

## Plan

### Step 1 — Definicja w README złota

- **Plik:** `tools/emb/gold/README.md`
- **Zmiana:** pięć etykiet (`same`, `contains`, `concept`, `pattern`, `different`). Przy każdej 2–3 krótkie przykłady na kodzie publicznym lub wymyślonym: funkcja, fragment, klasa, reguła CSS. Lista granic z CON-00. Dla `contains`: pole `larger: "a" | "b"`.
- **Done when:** ktoś bez kontekstu oceni przykładową parę z każdej granicy jednoznacznie

### Step 2 — Format i walidacja etykiet

- **Plik:** `tools/emb/gold/validate.mjs`, `tools/emb/gold-data.mts`, `tools/emb/eval.mts`
- **Zmiana:** walidacja przyjmuje 5 etykiet i `larger` (wymagane tylko przy `contains`). Miernik liczy `same` + `contains` + `concept` jako pozytywy i raportuje AP osobno per etykieta pozytywna (np. czy `contains` wypada gorzej niż `same`).
- **Done when:** `node tools/emb/gold/validate.mjs --selftest` łapie: `contains` bez `larger`, nieznaną etykietę

### Step 3 — Nowa ocena 241 par

- **Plik:** `tools/emb/gold/real-refs.jsonl`
- **Zmiana:** każdą parę ocenić według nowej definicji (kod czytany lokalnie z migawki). Szczególnie sprawdzić pary z etykietą `pattern`: która jest rozbudowaną wersją drugiej → `contains`. Pole `why` opisuje konkretny powód, nie ogólnik. Zmiany zapisać w `docs/experiments/emb-results.md` (ile par zmieniło etykietę i na jaką).
- **Done when:** 241 par z nowymi etykietami; `npm run emb:gold` OK; w gicie dalej zero kodu

## Constraints

- Kod prywatny tylko lokalnie; w gicie odnośniki + sha256
- Etykieta wynika z definicji, nie z wyniku modelu (nie patrzeć na podobieństwo przy ocenie)

## Pliki (scope)

- `tools/emb/gold/**`, `tools/emb/gold-data.mts`, `tools/emb/eval.mts`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run emb:gold
node tools/emb/gold/validate.mjs --selftest
npm run emb:eval -- --selftest
```

## Wyjście (acceptance)

- [ ] README z pięcioma etykietami i przykładami dla każdej jednostki
- [ ] 241 par ocenionych na nowo, zmiany policzone w emb-results
- [ ] Miernik raportuje per etykieta

## Po zakończeniu

1. Commit `Fixes CON-01: …`
2. `node tools/queue/close.mjs --id CON-01 --note "…"`

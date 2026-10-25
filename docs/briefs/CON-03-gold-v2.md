# CON-03 — Zestaw testowy v2: wszystkie jednostki, dwóch oceniających

**Queue:** `CON-03` | **Epic:** CON | **Segment:** semantic | **Layer:** 2

## Overview

Miara jakości obejmuje to, czego chce maintainer: kopie, rozbudowane wersje, fragmenty, klasy, reguły CSS i koncepcje rozłożone inaczej. Zestaw ma ≥ 800 ręcznie ocenionych par z prawdziwego kodu. Każda para ma drugą, niezależną ocenę, a różnice są rozstrzygnięte. Dzięki temu wiemy, czy nasze etykiety są spójne.

## Read first

1. `tools/emb/gold/README.md` — definicja po CON-01
2. `tools/emb/gold/real-candidates.mts` — dobór kandydatów po pasmach podobieństwa (EMB-12)
3. `packages/core/src/semantic/units.ts` — jednostki z CON-02

## Plan

### Step 1 — Kandydaci dla każdej jednostki

- **Plik:** `tools/emb/gold/real-candidates.mts`
- **Zmiana:** kandydaci z migawek Monorepo-A i Service-B dla par: funkcja–funkcja, funkcja–fragment (kandydaci do `contains`), fragment–fragment, klasa–klasa, reguła–reguła CSS. Dobór po pasmach podobieństwa obecnego modelu, także z niskich pasm, plus pary z reguły wzorca. Kod tylko lokalnie (`.tmp/`).
- **Done when:** kwoty per jednostka zapisane w skrypcie; ≥ 1200 kandydatów, żeby po odrzuceniu zostało ≥ 800

### Step 2 — Ocena główna

- **Plik:** `tools/emb/gold/real-refs.jsonl`
- **Zmiana:** ocena według README. Minimalne liczby w zestawie: 150 `contains`, 100 `concept`, 120 par klas, 100 par CSS, 150 `pattern`. Czego nie da się zebrać z celów, zostaje uzupełnione z otwartych repo z korpusu CON-04 (wtedy odnośnik do publicznego repo).
- **Done when:** ≥ 800 par; kwoty spełnione albo braki jawnie zapisane w emb-results

### Step 3 — Druga, niezależna ocena

- **Plik:** `tools/emb/gold/second-opinion.mts` (nowy), `.tmp/` na wyniki
- **Zmiana:** drugi oceniający dostaje te same pary i tylko README, bez pierwszej oceny. Dla par prywatnych to lokalny model albo osobny agent na tej maszynie, nigdy zewnętrzne API z prywatnym kodem. Liczymy zgodność (procent i kappa Cohena). Każdą rozbieżność rozstrzyga człowiek albo główny oceniający z zapisanym powodem.
- **Done when:** zgodność policzona i zapisana w emb-results; zero nierozstrzygniętych par

### Step 4 — Podział bez przecieku

- **Plik:** `tools/emb/gold/real-refs.jsonl`, `tools/emb/gold/validate.mjs`
- **Zmiana:** podział `validation` / `test` po stałym haśle **pliku** (nie pary). Para, której strony leżą w plikach z różnych części, idzie do `test`. Walidacja to sprawdza.
- **Done when:** selftest walidacji łapie podłożoną parę z plikiem w obu częściach

## Constraints

- Kod prywatny nigdy w gicie ani poza tym komputerem
- Oceniający nie widzi wyniku modelu

## Pliki (scope)

- `tools/emb/gold/**`, `tools/emb/gold-data.mts`, `docs/experiments/emb-results.md`

## Weryfikacja

```bash
npm run emb:gold
node tools/emb/gold/validate.mjs --selftest
npm run emb:eval -- --selftest
```

## Wyjście (acceptance)

- [ ] ≥ 800 par, kwoty per jednostka i etykieta
- [ ] Zgodność dwóch oceniających zapisana, rozbieżności rozstrzygnięte
- [ ] Podział po plikach, bez przecieku

## Po zakończeniu

1. Commit `Fixes CON-03: …`
2. `node tools/queue/close.mjs --id CON-03 --note "…"`

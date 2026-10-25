# DUST-15 — Pomiar: czy embeddingi znajdują coś sensownego

**Queue:** `DUST-15` | **Epic:** DUST | **Segment:** research | **Layer:** 15

## Overview

Zanim zbudujemy wykrywanie „to samo, inaczej napisane” (DUST-05), mierzymy na prawdziwym kodzie, czy to w ogóle działa. Wynik: liczba trafnych grup na próbce i decyzja, czy DUST-05 jest domyślnie włączone, jakim modelem i z jakim progiem. Żadnego kodu produktu — tylko eksperyment i raport.

## Read first

1. [docs/TEST-TARGETS.md](../TEST-TARGETS.md) — zasady pracy na Monorepo-A (tylko odczyt)
2. README jscpd — aktualne flagi `--semantic*` (tryb eksperymentalny od 5.3)

## Plan

### Step 1 — Przebieg na Monorepo-A

- **Plik:** `docs/experiments/embedding-spike.md`
- **Zmiana:** `npx jscpd@<przypięta wersja> --semantic` z lokalnym modelem domyślnym (jina-embeddings-v2-base-code) na bibliotece aplikacji webowej Monorepo-A + `packages/*/src` (bez testów, fixtures, wygenerowanych). Wynik do `.tmp/spike/`. Zapisz: wersję jscpd, model, czas, liczbę funkcji, liczbę par.
- **Done when:** przebieg skończony, liczby w raporcie.

### Step 2 — Ręczna ocena próbki

- **Plik:** `docs/experiments/embedding-spike.md`
- **Zmiana:** 30 losowych par z trzech pasm podobieństwa (najwyższe / środek / dolny próg). Każda: `real` (prawdziwy duplikat do scalenia) / `pattern` (celowo podobne, np. schematy, trasy) / `noise`. Plus: ile `real` jscpd tokenowy **nie** znalazł (wartość dodana embeddingów).
- **Done when:** tabela 30 werdyktów z jednym zdaniem uzasadnienia każdy.

### Step 3 — Decyzja

- **Plik:** `docs/experiments/embedding-spike.md`, `docs/briefs/DUST-05-semantic-similarity.md`
- **Zmiana:** jedna z: (a) DUST-05 domyślnie włączone, próg X; (b) domyślnie wyłączone, opcja; (c) inny model — który i dlaczego (przebieg porównawczy, max 2 modele). Dopisz wynik do „Read first” DUST-05.
- **Done when:** decyzja z liczbami.

## Constraints

- Monorepo-A tylko do odczytu, wynik poza nim (`.tmp/spike/`)
- Zero kodu w `packages/`
- Pobranie modelu = jednorazowe, do cache jscpd; nie commitować modelu

## Pliki (scope)

- `docs/experiments/embedding-spike.md`
- `docs/briefs/DUST-05-semantic-similarity.md`

## Weryfikacja

```bash
npm run queue:validate
```

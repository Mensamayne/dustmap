# CON-14 — Prawdziwy trening v2, paczka, pomiar i decyzja o domyślnym

**Queue:** `CON-14` | **Epic:** CON | **Segment:** semantic | **Layer:** 8

## Overview

Model uczy się na danych z CON-13 przez pełne przejścia, z dużymi porcjami. Wybór wersji opiera się na wyrównanej walidacji z CON-12. Wynik jest porównany z EMB-15 naprawionym miernikiem na każdej etykiecie i jednostce, na pułapce, w labie i na Monorepo-A. Lepszy model zostaje domyślnym. CON-11 tego nie zrobił: ok. 530 kroków po 16 przykładów z tempem 5e-6 to ok. 10 minut, wagi prawie się nie zmieniły.

## Read first

1. `../dustmap-emb/train.py`, `../dustmap-emb/configs/private-w2*.yaml`
2. `docs/briefs/CON-12-meter-and-gold-repair.md`, `docs/briefs/CON-13-data-at-scale.md`
3. `docs/experiments/emb-results.md` § EMB-14 / EMB-15 (przepis, który działał)

## Plan

### Step 1 — Przepis

- **Plik:** `../dustmap-emb/train.py`, `../dustmap-emb/configs/private-w2-con14.yaml`
- **Zmiana:**
  - efektywna porcja ≥ 64 par w stracie w obrębie porcji (z gradient checkpointing albo podziałem porcji z pamięcią osadzeń, gdy karta nie mieści);
  - tempo nauki jak w EMB-15;
  - 2 epoki;
  - strata par jak w EMB-14;
  - wybór wersji po AP walidacji (bez pułapki) z CON-12, ocena co ok. 10% kroków;
  - start od W2 bazowego i, osobno, od EMB-15. Oba przebiegi zapisane.
- **Done when:** konfiguracja i krótki przebieg 5% na GPU bez błędów pamięci

### Step 2 — Pełne przebiegi

- **Plik:** `../dustmap-emb/configs/private-w2-con14*.yaml`, `docs/experiments/emb-results.md`
- **Zmiana:** pełne przebiegi na GPU; krzywa AP walidacji per etykieta
- **Done when:** najlepszy checkpoint wybrany po walidacji, nie po teście

### Step 3 — Paczka i kalibracja

- **Plik:** `../dustmap-emb/configs/release-con14.yaml`, `tools/emb/calibrate.mts`
- **Zmiana:** eksport, int8 CPU + fp16 GPU, `verify_package`, kalibracja na walidacji CON-12
- **Done when:** paczka zainstalowana lokalnie; manifest z pasmami

### Step 4 — Pomiar i decyzja

- **Plik:** `docs/experiments/emb-results.md`, `tools/targets/monorepo-a.dustmap.config.json` (tylko przy zmianie domyślnego), `packages/core/src/config/schema.ts` (tylko przy zmianie domyślnego)
- **Zmiana:**
  - miernik na teście: AP ogółem, per etykieta, per jednostka, pułapka;
  - lab (`../dustmap-lab`, scenariusze semantyczne);
  - skan Monorepo-A: ręczny przegląd 30 losowych grup high i 30 medium, ocena prawdziwe / wzorzec / szum.

  Domyślny = model lepszy na teście **i** z precyzją high na Monorepo-A ≥ EMB-15.
- **Done when:** tabela porównania + werdykt z liczbami

## Constraints

- Uczenie tylko na GPU; przy braku wolnej pamięci karty czekać, nie przełączać na CPU
- Test nie służy do wyboru wersji ani progów
- Prywatny model nie opuszcza tego komputera

## Pliki (scope)

- `../dustmap-emb/train.py`, `../dustmap-emb/configs/**`, `../dustmap-emb/DATA-CARD.md`, `tools/emb/**`, `docs/experiments/emb-results.md`, `tools/targets/*.dustmap.config.json`, `packages/core/src/config/schema.ts`, `../dustmap-lab/results/**`

## Weryfikacja

```bash
npm run emb:eval -- --provider onnx --model <paczka> --calibrated
npm run verify
npm run verify:targets
```

## Wyjście (acceptance)

- [ ] Przebiegi z krzywymi, wybór po walidacji
- [ ] Paczka + kalibracja
- [ ] Porównanie z EMB-15 na teście, pułapce, labie i Monorepo-A; werdykt o domyślnym

## Po zakończeniu

1. Commit `Fixes CON-14: …`
2. `node tools/queue/close.mjs --id CON-14 --note "…"`

# DUST-14 — Opcjonalny sędzia LLM dla klastrów

**Queue:** `DUST-14` | **Epic:** DUST | **Segment:** core | **Layer:** 14

## Overview

Dla klastrów duplikatów i najwyżej ocenionych miejsc model językowy dopisuje werdykt: „prawdziwy duplikat”, „celowy wzorzec” albo „nie wiadomo” + jedno zdanie dlaczego. **Domyślnie wyłączony** — bez niego raport jest pełny, a ocenę robi agent czytający raport.

## Plan

### Step 1 — Dostawca i zgoda

- **Plik:** `packages/core/src/judge/provider.ts`
- **Zmiana:** `judge.enabled: false` domyślnie; dostawca OpenAI-compatible lub Anthropic, klucz tylko z env; limit liczby klastrów na skan i budżet tokenów w configu; cache werdyktu po fingerprincie.
- **Done when:** test: `enabled: false` → zero żądań; brak klucza przy `true` = czytelny błąd.

### Step 2 — Werdykt w raporcie

- **Plik:** `packages/core/src/judge/annotate.ts`
- **Zmiana:** pole `judgement { verdict, reason, model }` przy znalezisku (rozszerzenie kontraktu v1 — opcjonalne pole, bez bumpu wersji); werdykt nie zmienia `confidence` ani rankingu, tylko informuje.
- **Done when:** test na nagranej odpowiedzi modelu (bez sieci w CI).

## Constraints

- Werdykt sędziego nigdy nie wyzwala zapisu ani `enqueue`
- Zero wiedzy o konkretnym projekcie użytkownika w kodzie paczek

## Pliki (scope)

- `packages/core/src/judge/**`
- `packages/contract/src/finding.ts`
- `packages/core/__tests__/**`

## Weryfikacja

```bash
npm run verify
npm run verify:targets
```

Notatka zamknięcia: liczby z celów `monorepo-a` i `service-b` (znaleziska per kategoria, czas, 3 przykłady z oceną) — [TEST-TARGETS](../TEST-TARGETS.md).

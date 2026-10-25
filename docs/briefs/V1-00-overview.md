# V1-00 — Overview: domknięcie v1 — wymienne modele, sędzia albo bez sędziego

**Queue:** `V1-00` | **Epic:** V1 | **Segment:** duplicates | **Layer:** 0

## Po co

Decyzja maintainera (25.10.2026): nie trenujemy dalej sędziego par — domykamy v1 na tym, co jest. „ważne, żeby embeddingowy był i system miał możliwość uruchomienia z dowolnym embeddingowym i dowolnym judge'em albo bez judge'a w ogóle […] nawet modelu providowanego przez API np. claude czy gpt”.

Stan v1 (docs/experiments/dup-results.md): L1/L2/L5 bez modeli; L3 model wektorowy (partner w top-20: 88 %); L4 sędzia par `dustmap-pair-judge-private` (AP 0,736, pułapka 51/193, L2 po sędzi 0,97, GPU 75 par/s, CPU 4,4). Modele wektorowe są już wymienne (`semantic.provider`: paczka onnx / API zgodne z OpenAI / brak). Sędzia nie: tylko nasza paczka albo nic, ocenia tylko pary semantyczne, a stary sędzia LLM (DUST-14) tylko dopisuje komentarz i nie widzi kodu.

## Briefy

| ID | Co | Gates |
|----|----|----|
| V1-01 | Jeden wymienny sędzia par: `judge.provider` onnx / openai / anthropic / none; stary sędzia LLM zastąpiony; cache wyników adapterów zależny od modelu i sędziego | V1-00 |
| V1-02 | Sędzia także na L1-kształt i L2 | V1-01 |
| V1-03 | Miernik dla dowolnego sędziego (paczka, API) | V1-01 |
| V1-04 | Dokumentacja konfiguracji i laboratorium (fałszywy serwer API) | V1-02, V1-03 |

## Twarde zasady

- Lokalnie domyślnie: nic nie wychodzi z komputera bez `allowRemote: true`; klucze tylko ze zmiennych środowiskowych.
- Sędzia obniża albo podnosi pewność, nigdy nie kasuje znaleziska.
- Każdy sędzia mierzony tą samą drogą co skan (lekcja BUG-14).

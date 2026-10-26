# Otwarte decyzje (maintainer)

| # | Decyzja | Stan | Uwagi |
|---|---------|------|-------|
| 1 | **Licencja** | **MIT** (25.10.2026) | Zależności Knip ISC, jscpd MIT, dependency-cruiser MIT — zgodne. `LICENSE` + pole `license` we wszystkich pakietach (REL-04). |
| 2 | **GitHub: właściciel i widoczność** | **publiczne `Mensamayne/dustmap`** (25.10.2026) | Historia pełna, oczyszczona z prywatnych projektów na osobnym klonie (REL-05). |
| 3 | **Nazwa na npm** | wstępnie `dustmap` | 15.10.2026: `dustmap` wolne na npm. Paczki: `@dustmap/*` wymagają organizacji `dustmap` na npm. |
| 4 | **Podłączenie do Monorepo-A** | po DUST-13 | Konfiguracja punktów wejścia monorepo + wtyczka briefów do `docs/agent-briefs/` — zadanie w kolejce Monorepo-A, gdy Dustmap będzie działał. |
| 5 | **Modele na Hugging Face** | **`Mensamayne/dustmap-models`** (26.10.2026) | MIT, bez opłat. Opublikowane: `dustmap-same-meaning` + `dustmap-pair-judge` (przemianowane z `*-private`). Paczka z `private: true` w manifeście nadal odmowa w `model pull`. |

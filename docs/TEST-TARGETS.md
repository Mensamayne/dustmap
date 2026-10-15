# Cele testowe — gdzie i jak testować Dustmap na prawdziwym kodzie

Fixtures w `packages/*/fixtures/` sprawdzają pojedyncze przypadki. **Prawdziwą jakość** (ile znalezisk jest trafnych, czy narzędzie wytrzymuje skalę) sprawdza się na prawdziwych repo maintainera. Ten plik mówi agentowi, gdzie one są, co w nich jest i czego nie wolno.

## Twarde zasady (każdy cel)

1. **Cel jest tylko do odczytu.** Zero zapisu w jego katalogu — także `.dustmap/`. Wynik skanu idzie do `dustmap/.tmp/targets/<cel>/` (opcja `outputDir`, DUST-02).
2. **Zero operacji git zapisujących w celu:** żadnego `worktree add`, `checkout`, `stash`, `commit`, `fetch`. Wolno tylko czytać: `git log`, `git ls-files`, `git show`, `git archive`.
3. **Nie uruchamiaj skryptów celu** (`npm install`, `npm run …`, docker, dev serwer). Skanujemy pliki, nie odpalamy projektu.
4. Maintainer pracuje w celu na żywo. **Skan „live” może się zmieniać między przebiegami** — do pomiarów jakości używaj migawki (niżej).

## Rejestr celów

Plik `tools/targets/targets.json` (DUST-16). Ścieżka każdego celu da się nadpisać zmienną środowiskową — inny komputer, inna ścieżka.

### `monorepo-a` — duży, prawdziwy, zabałaganiony (główny poligon)

| | |
|--|--|
| **Ścieżka** | `../monorepo-a` (obok tego repo) · env `DUSTMAP_TARGET_MONOREPO_A` |
| **Skala (15.10.2026)** | ~23 tys. plików w git, ~10 tys. plików TS/TSX, ~1,27 mln linii TS, 74 paczki workspace, ~2,55 tys. commitów |
| **Inne języki** | Java (`‹private›-java`, ~220 plików), Dart (`monorepo-a-‹private›`, zamrożony), dużo JSON (seedy katalogu) — Dustmap **nie może się na nich wywrócić**, ma je pominąć albo zgłosić „nieobsługiwane” |

Co tu jest i dlaczego to dobry test:

| Pułapka dla skanera | Gdzie w Monorepo-A | Czego oczekujemy |
|---------------------|--------------------|------------------|
| Trasy ładowane przez framework (Next app router) | `monorepo-a-web/app/**/page.tsx`, `route.ts` (~400 plików) | **nigdy** „martwe” z wysoką pewnością |
| Rejestr akcji (rejestracja przez wywołanie, nie import) | `defineAction(` w ~175 plikach, `‹private›/` | po skonfigurowaniu punktów wejścia — nie „martwe” |
| Paczki z CLI i serwerami MCP | `packages/*/bin`, `packages/*-mcp/` | `bin` z `package.json` = punkt wejścia |
| Skrypty wołane z `package.json` | `tools/**/*.mjs` (setki), root `package.json` | żywe, jeśli wymienione w skryptach |
| Pliki ładowane po nazwie | seedy katalogu (JSON), fixtures, `‹private›/` (generowane) | niska pewność albo wykluczone w configu |
| Prawdziwe śmieci (dobre trafienia) | luźne `monorepo-a-web/*.js` typu `‹private›`, jednorazowe `‹private›/‹private›` | powinny wyjść jako kandydaci |
| Kod pisany przez agentów, którzy dopisują i nie kasują | całe repo | duplikaty po sensie, powtórzone warunki |
| Długa historia | 2,5 tys. commitów, masowe commity (formatowanie, wydania) | sygnały git bez szumu z masowych commitów |

Konfiguracja punktów wejścia Monorepo-A żyje w `tools/targets/monorepo-a.dustmap.config.json` **w tym repo**, nie w Monorepo-A.

### `service-b` — mały i czysty (cel kontrolny)

| | |
|--|--|
| **Ścieżka** | `../service-b` · env `DUSTMAP_TARGET_SERVICE_B` |
| **Skala** | ~130 plików TS, ~25 commitów, npm workspaces |

Służy do sprawdzenia, że na porządnym repo Dustmap **nie krzyczy**: mało znalezisk, zero fałszywych „martwych” wysokiej pewności. Jeśli tu raport jest długi — problem jest w narzędziu, nie w repo.

### `self` — Dustmap skanuje sam siebie

Od DUST-10: `dustmap scan` na tym repo, wynik w `.tmp/targets/self/`. Własny brud wychodzi pierwszy.

## Dwa tryby uruchomienia

| Tryb | Komenda (DUST-16) | Do czego |
|------|-------------------|----------|
| **live** | `npm run target -- monorepo-a` | szybki rzut oka po zmianie; dysk celu taki, jaki jest teraz |
| **snapshot** | `npm run target -- monorepo-a --snapshot <sha>` | pomiary jakości i zbiór prawdy; `git archive <sha>` z celu (tylko pliki kodu i `package.json` / `tsconfig` / `.gitignore` / `.gitattributes`) do `.tmp/targets/monorepo-a@<sha12>/src/`, tam świeże `git init` — reguły ignorowania i atrybuty działają jak w oryginale; pierwszy raz ~20 s, potem z pamięci |
| **ad hoc** | `npm run target -- --path <katalog> [--label x]` | dowolne repo bez wpisu w rejestrze |

Wynik każdego przebiegu: `.tmp/targets/<etykieta>/inventory.json` (pliki per rola, pominięte z powodem, punkty wejścia, czasy) i — gdy są wykrywacze — `out/report.json`.

| Komenda | Co robi |
|---------|---------|
| `npm run target:compare -- monorepo-a` | raport przypiętej migawki vs zbiór prawdy; czerwone przy naruszeniu zakazu, spadku trafności, raporcie z innego commita |
| `npm run verify:targets` | migawka + porównanie dla każdego celu ze zbiorem prawdy; brak celu = czerwone (kod 2), nigdy udawane zielone |

## Zbiór prawdy i pomiar trafności

`tools/targets/ground-truth/monorepo-a.json` (DUST-16): znaleziska przejrzane ręcznie na przypiętej migawce, każde z werdyktem `real` / `false-positive` / `intended-pattern` i jednym zdaniem dlaczego. Raport porównuje się z tym zbiorem:

- **trafność wysokiej pewności** = ile znalezisk `high` z próbki to `real` — bramka: nie spada między wersjami,
- **twarde zakazy** (np. „żadna `page.tsx` jako martwa `high`”) — bramka: zero naruszeń.

Przypięte commity: `monorepo-a` → `dbe35aa00cd6`, `service-b` → `0c0aa958e6b3` (pole `sha` w plikach zbioru prawdy). Nowy commit = nowa migawka i ponowny przegląd werdyktów, nie cicha podmiana.

Stan 16.10.2026: zbiór prawdy ma tylko zakazy — wykrywacze jeszcze nie istnieją. 30 par ocenionych w pomiarze embeddingów ([experiments/embedding-spike.md](experiments/embedding-spike.md)) trafia tu jako werdykty, gdy DUST-05 nada im odciski.

## Raportowanie przy zamknięciu briefu

Każdy brief, który zmienia wynik skanu (DUST-03…09, 14), kończy się przebiegiem na `monorepo-a` i `service-b`. W notatce zamknięcia: liczba znalezisk per kategoria, czas skanu, 3 przykłady z oceną „trafne / nietrafne”. Bez tego brief nie jest skończony.

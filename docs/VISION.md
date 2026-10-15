# Dustmap — wizja

**Mapa kurzu w repo.** Narzędzie robi przegląd higieny kodu i zostawia raport. Nigdy nie rusza kodu. Raport czyta agent AI albo człowiek i to oni decydują, co sprzątnąć.

## Skąd pomysł

Agenci AI piszą dużo kodu i rzadko coś usuwają. Z czasem rosną martwe pliki, kopie, funkcje robiące to samo inaczej i „makaron”. Na GitHubie są dobre narzędzia do pojedynczych kawałków (Knip, jscpd, dependency-cruiser), ale każde działa osobno, mówi swoim formatem i nie jest pisane pod agentów. Brakuje jednego raportu z rankingiem i pamięcią decyzji.

## Dwa tryby skanu

- **Całe repo** — pełny przegląd od zera. Kolejne skany liczą od nowa tylko zmienione pliki.
- **Tylko zmiany** — szybki skan pull requesta: „czy ta zmiana dokłada śmieci?”. Tryb zapadki w CI.

## Co raport pokazuje

1. **Martwy kod** — nieużywane pliki, eksporty, zależności.
2. **Kopiuj-wklej** — ten sam blok w wielu miejscach, zebrany w grupy.
3. **To samo, inaczej napisane** — „te 5 funkcji robi praktycznie to samo” (embeddingi z lokalnego modelu).
4. **Sygnały do przebudowy** — bez recepty, tylko diagnoza z dowodem:
   - zawiła funkcja, ogromny plik, długa lista parametrów, flagi tak/nie,
   - ten sam warunek rozsiany po wielu plikach (brakuje jednego miejsca, które o tym decyduje),
   - gorące miejsca: kod zawiły i zmieniany co chwilę,
   - pliki zawsze zmieniane razem, dużo poprawek w jednym miejscu,
   - cykle importów, moduły od których zależy pół repo, łamanie warstw.

Jeden sygnał to często szum. **Kilka sygnałów w tym samym miejscu** to mocna wskazówka — raport układa miejsca według sumy, więc na górze jest ~10 miejsc wartych uwagi, nie setki ostrzeżeń.

## Gdzie kończy się pipeline

```
skanery → podobieństwo → sygnały → ranking → RAPORT (.dustmap/report.json)
                                                │
          agent AI (MCP/CLI) · markdown · SARIF w GitHubie · zgłoszenia · kolejka briefów
```

Raport to umowa. Rdzeń tylko go zapisuje. Wyjścia to wtyczki, które każdy włącza sam.

Każde znalezisko ma:
- **stały odcisk** (z treści kodu, nie numeru wiersza) — żeby nie dublować zadań i pamiętać decyzje,
- **dowód** (gdzie, dlaczego, jak pewne),
- **jak sprawdzić**, że usunięcie niczego nie psuje,
- commit, na którym zrobiono skan.

**Decyzje ludzi** („zostaw, bo framework ładuje to po nazwie”) zapisują się w repo. Odrzucone znalezisko nie wraca, dopóki kod się nie zmieni.

## Jak inni podłączą

`npx dustmap init` → `npx dustmap scan` → `npx dustmap summary`. Serwer MCP dla agentów. Gotowa akcja GitHuba z zapadką. Lokalnie i za darmo domyślnie; sędzia LLM to opcja.

## Czego Dustmap nie robi

- Nie zmienia kodu i nie commituje.
- Nie mówi, *jak* przebudować — tylko *gdzie boli i po czym widać*.
- Nie wysyła kodu na zewnątrz bez jawnej zgody w configu.

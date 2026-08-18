# Kursprüfung in der Oberfläche

Stand: 2026-08-17

StockPilot zeigt neben der allgemeinen Datenqualität auch den Status der
anbieterübergreifenden Kursprüfung. Die Anzeige übernimmt keine Preise und
mittelt keine Anbieterwerte. Der Primärkurs bleibt unverändert.

## Zustände

| Anzeige | Bedeutung | Analyse |
|---|---|---|
| Quellen bestätigt | Vergleichbare zweite Quelle innerhalb der Toleranz | gemäß restlicher Datenqualität möglich |
| Einzelquelle | nur eine verwertbare Quelle | keine unabhängige Bestätigung |
| Quellen weichen ab | erhebliche Preisabweichung | gesperrt |
| Nicht vergleichbar | Instrument, Währung oder Marktphase unterscheiden sich | nicht als Bestätigung gewertet |
| Vergleich veraltet | Zeitstempel liegen zu weit auseinander | nicht als Bestätigung gewertet |

Die Detailerklärung ist über den zugänglichen Namen und den Tooltip des Badges
verfügbar. Dashboard, Marktband, Watchlist und Asset-Detailseite verwenden
denselben zentralen Zustand.

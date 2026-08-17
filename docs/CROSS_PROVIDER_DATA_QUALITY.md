# Cross-Provider Data Quality

Stand: 2026-08-17

## Grundsatz

StockPilot mittelt Marktkurse verschiedener Anbieter niemals blind. Der erste
nach Routing, Lizenz und Health priorisierte Kurs bleibt der ausgewaehlte
Datenpunkt. Bis zu drei weitere Anbieter duerfen ihn nur kontrollieren.

Vor einem Preisvergleich muessen uebereinstimmen:

- kanonisches Symbol und Assetklasse,
- tatsaechliche Handelswaehrung des Providerprodukts,
- Marktphase,
- ausreichend naher Providerzeitpunkt.

`BTC-USD` von Coinbase und `BTCUSDT` von Binance sind deshalb keine identische
Beobachtung. Sie werden als Waehrungsunterschied markiert und nicht gemittelt.

## Ergebnisse

- `single_source`: nur ein Provider lieferte einen belastbaren Kurs.
- `confirmed`: vergleichbare Beobachtungen liegen innerhalb der dynamischen
  Toleranz. Der Primaerkurs bleibt unveraendert.
- `divergent`: vergleichbare Beobachtungen weichen zu stark ab. Der Quote wird
  `DIVERGENT`, sein Qualitaetsscore wird auf maximal 25 begrenzt und aktuelle
  Analysen werden gesperrt.
- `incomparable`: Instrument, Waehrung oder Marktphase passen nicht zusammen.
- `stale_comparison`: Zeitstaende liegen zu weit auseinander.

Die Toleranz beruecksichtigt Assetklasse, Marktstatus und beobachteten Spread.
Ein geschlossener Markt erhaelt mehr Spielraum; Forex weniger als Krypto.

## Betrieb und Kosten

```dotenv
MARKET_DATA_CROSSCHECK_PROVIDER_COUNT=2
MARKET_DATA_CROSSCHECK_TOLERANCE_BPS=75
MARKET_DATA_CROSSCHECK_MAX_SKEW_MS=120000
```

Alle Kontrollabrufe laufen weiterhin durch Provider-Cache, Rate Limits,
Concurrency-Limits und Circuit Breaker. Der Count ist auf vier begrenzt.
Ausgefallene Zweitquellen ersetzen oder veraendern den Primaerkurs nicht.

## Analysevertrag

`cross_provider_confirmed` erhoeht nur die Datenqualitaet, nie eine
Kaufwahrscheinlichkeit. `cross_provider_price_divergence` sperrt aktuelle
Analysen. Nicht vergleichbare Quellen werden als Datenluecke ausgewiesen,
nicht als Widerspruch oder Konsens.

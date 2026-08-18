# Binance Spot Streaming

Stand: 2026-08-17

## Umfang

StockPilot nutzt den offiziellen, oeffentlichen Market-Data-WebSocket von
Binance serverseitig. Ein geteilter Hub verteilt eine kombinierte Verbindung
an viele SSE-Nutzer und abonniert je nach Bedarf:

- `ticker` fuer 24-Stunden-Statistik und letzten Kurs,
- `bookTicker` fuer Best Bid/Ask und Mengen,
- `trade` fuer einzelne Venue-Trades,
- `kline_<interval>` fuer laufende Kerzen.

Der Browser verbindet sich nie direkt mit Binance. Der bestehende
`/api/market/stream`-Pfad liefert normalisierte Quotes und faellt bei einem
Streamproblem kontrolliert auf REST-Polling zurueck.

## Resilienz

- eine Upstream-Verbindung pro Serverprozess,
- standardmaessig maximal 30 aktive Produkte,
- gebuendelte Subscribe-/Unsubscribe-Nachrichten,
- Inaktivitaets-Watchdog und exponentieller Reconnect,
- geplante Rotation vor dem Binance-Limit von 24 Stunden,
- monotone Book-Update-IDs und lueckenlose Trade-IDs,
- langsame Clients werden isoliert, nicht der gesamte Hub,
- Providerfehler und `serverShutdown` erzwingen einen Neuaufbau.

Binance-WebSocket-Ping/Pong wird von der Server-WebSocket-Laufzeit beantwortet.

## Datenwahrheit

Binance- und Coinbase-Kurse werden nie zu einem scheinbar identischen Preis
vermischt. Angefragtes `BTC-USD` kann bei Binance technisch `BTCUSDT` sein.
StockPilot behaelt deshalb `BTCUSDT`, Venue `BINANCE`, Waehrung `USDT` und den
Qualitaetshinweis `requested_usd_mapped_to_usdt` am Datenpunkt.

`ticker` liefert eine rollierende 24-Stunden-Statistik, keinen UTC-Boersentag.
`bookTicker` enthaelt laut Provider keinen Ereigniszeitstempel; das wird als
Datenluecke markiert. Laufende Kerzen tragen `open_candle` und werden nicht als
abgeschlossen behandelt.

Ein lokales Voll-Orderbuch wird noch nicht gefuehrt. Deshalb behauptet die App
auch keine Depth-Snapshot-Synchronitaet. Best Bid/Ask kommt aus `bookTicker`.

## Konfiguration

```dotenv
MARKET_DATA_ENABLE_BINANCE=true
STOCKPILOT_CRYPTO_PROVIDER=binance
BINANCE_STREAM_ENABLED=true
BINANCE_STREAM_MAX_SYMBOLS=30
BINANCE_DATA_QUALITY=near_realtime
```

Der oeffentliche Stream braucht keinen API-Key. Externe kommerzielle Anzeige
bleibt trotzdem von dokumentierten Nutzungs- und Anzeigerechten abhaengig.

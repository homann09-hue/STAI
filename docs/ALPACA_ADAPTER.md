# Alpaca-Adaptervertrag

Stand: 2026-08-16

## Zweck und Grenze

Alpaca liefert StockPilot in Phase 7 serverseitige US-Aktien- und ETF-Daten.
Der kostenlose Basic-Tarif umfasst Echtzeitdaten ausschließlich über IEX. IEX
ist ein einzelner Handelsplatz und ausdrücklich **kein** konsolidierter
US-Gesamtmarkt. Die UI- und Datenprovenienz nennt den Feed deshalb als
`Alpaca IEX (einzelner Handelsplatz)`.

## Implementierte Pfade

- Einzel- und Batch-Snapshots mit letztem Trade, Bid/Ask, Größen, Tagesbar und
  Vortagesbar
- letzte Trades für mehrere Symbole
- rohe historische Bars mit Pagination und explizitem `adjustment=raw`
- US-Marktstatus über die Alpaca-Clock
- WebSocket für Quotes und Trades mit Authentifizierung, Multi-Symbol-
  Subscription, Reconnect, Resubscribe, Symbollimit, Backpressure-Schutz und
  sauberem Abort
- REST-Polling als Fallback, wenn Streaming deaktiviert oder nicht verfügbar
- zentrale Rate-Limits, Retries, Circuit Breaker und secret-freie Health-Pings

## Konfiguration

```dotenv
ALPACA_API_KEY_ID=
ALPACA_API_SECRET_KEY=
ALPACA_DATA_FEED=iex
ALPACA_STREAM_ENABLED=false
ALPACA_STREAM_MAX_SYMBOLS=30
ALPACA_BATCH_MAX_SYMBOLS=30
ALPACA_HISTORY_MAX_PAGES=5
ALPACA_TRADING_ENV=paper
MARKET_DATA_ENABLE_ALPACA=false
```

Erlaubte Feeds sind `iex`, `sip` und `delayed_sip`. `delayed_sip` wird mit
900 Sekunden Verzögerung normalisiert und kann niemals als Realtime gelten.
`sip` darf erst mit passendem Tarif verwendet werden.

## Rechte und Produktion

Ein API-Schlüssel ist kein Display-Recht. Preview und Produktion bleiben ohne
explizite Aufnahme von `alpaca` in die Lizenz- und Display-Allowlisten
fail-closed. Redistribuierung bleibt unabhängig davon gesperrt. Der Basic-Tarif
ist für Entwicklung und Forschung vorgesehen; kommerzielle Endnutzeranzeige
muss vor Aktivierung vertraglich geprüft werden.

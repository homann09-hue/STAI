# Coinbase Advanced Trade Streaming

Stand: 2026-08-17

## Zweck

Coinbase liefert schnelle Kryptokurse serverseitig ueber den oeffentlichen
Advanced-Trade-WebSocket. Der Browser verbindet sich weiterhin nur mit
`/api/market/stream`; Provideradressen und spaetere Zugangsdaten bleiben aus
dem Client entfernt.

## Betriebsvertrag

- Endpoint: `wss://advanced-trade-ws.coinbase.com`
- Kanaele: `ticker` und `heartbeats`
- Eine Upstream-Verbindung pro Serverprozess wird an mehrere SSE-Nutzer
  verteilt. Das verhindert eine Providerverbindung pro Nutzer.
- Neue Produktabos werden gebuendelt. Maximal 30 gleichzeitig aktive Produkte
  sind standardmaessig erlaubt.
- Heartbeat-Ausfall, Providerfehler und Sequenzluecken erzwingen Reconnect.
- Ein langsamer Client wird isoliert beendet; er blockiert nicht andere Nutzer.
- Kann Streaming nicht sicher fortgesetzt werden, schaltet der bestehende
  Browserpfad auf begrenztes REST-Polling um.

## Datenwahrheit

Transport ueber WebSocket bedeutet nicht automatisch lizenzrechtlich
verifizierte Echtzeit. `COINBASE_DATA_QUALITY` bleibt deshalb standardmaessig
`near_realtime`. Provider, Providerzeit, Empfangszeit und gemessene Latenz
bleiben am normalisierten Kurs erhalten.

Coinbase bildet bei vielen `*-USDC`-Abos nicht das angefragte Produkt, sondern
das entsprechende `*-USD`-Produkt ab. StockPilot lehnt diese mehrdeutigen
Streams ab; nur die von Coinbase ausgenommenen Paare `USDT-USDC` und
`EURC-USDC` werden akzeptiert. Es findet keine stille Identitaetsumdeutung
statt.

## Konfiguration

```dotenv
MARKET_DATA_ENABLE_COINBASE=true
STOCKPILOT_CRYPTO_PROVIDER=coinbase
COINBASE_STREAM_ENABLED=true
COINBASE_STREAM_MAX_SYMBOLS=30
COINBASE_DATA_QUALITY=near_realtime
```

Der Feed ist oeffentlich und braucht keinen API-Key. Vor externer kommerzieller
Anzeige muessen Nutzungs- und Anzeigerechte trotzdem dokumentiert sein.

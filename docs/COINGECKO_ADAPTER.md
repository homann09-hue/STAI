# CoinGecko-Referenzadapter

Stand: 2026-08-17

CoinGecko liefert in StockPilot kanonische Coin-IDs, Handelspaar-Zuordnung,
Kategorien, Blockchain-Adressen, Market Cap, Volumen, Supply, gemeldete Börsen
und globale Kryptomarktbreite. CoinGecko ist nicht der alleinige sekündliche
Kursfeed: schnelle Kurse kommen weiterhin von Coinbase beziehungsweise Binance.

`BTC-USD`, `BTC/USD`, `BTCUSD` und `BTC` werden in Basis- und Quote-Symbol
zerlegt. Häufige Coins besitzen explizite kanonische IDs. Unbekannte Symbole
werden nur bei genau einem exakten Suchtreffer übernommen. Mehrere Treffer
führen zu HTTP 409; StockPilot rät nicht nach Rang oder Popularität.

Der öffentliche API-Host funktioniert ohne Schlüssel. Optional bleiben
`COINGECKO_API_KEY` und `COINGECKO_API_PLAN=demo|pro` serverseitig. Schlüssel
stehen nur in allowgelisteten Headern, nie in URLs, Browserdaten oder Logs.

`MARKET_DATA_ENABLE_COINGECKO=true` aktiviert den Adapter. Preview und
Produktion bleiben über die zentrale Lizenzprüfung fail-closed, bis externe
Anzeigerechte dokumentiert sind. Die Endpunkte `GET /api/crypto/metadata/[symbol]`
und `GET /api/crypto/global` sind rate-limitiert, gecacht, größen- und
zeitbegrenzt. Die UI kennzeichnet Werte als `DELAYED` oder `CACHED`, nie als
sekündliches Realtime-Signal.

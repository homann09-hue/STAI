# StockPilot AI Top-Provider Gap Analysis

Datum: 2026-07-02

Scope: STAI / StockPilot AI in `/Users/angelo/Documents/PWA-Akti`

## Vergleichsrahmen

Als Qualitätsmaßstab wurden Funktionsbereiche professioneller Finanz- und Research-Produkte betrachtet: TradingView, Yahoo Finance, MarketWatch, Finviz, Seeking Alpha, Simply Wall St, Koyfin, TipRanks und ähnliche Anbieter. Es wurden keine Designs, Texte, Logos oder geschützten UI-Muster kopiert.

## Schon vorhanden

- Mobile-first Finanzterminal mit Dashboard, Marktübersicht, Watchlist, Portfolio, Alerts, News, Screener, Learn-Bereich und Asset-Detailseiten.
- Provider-Schicht für echte oder delayed Marktdaten mit Server-Caching, Rate-Limit-Backoff und sichtbarer Datenqualität.
- Aktien, ETFs, Krypto, Indizes, Forex und weitere Assetklassen sind im Marktuniversum modelliert.
- Detailseiten mit Chart-Zeiträumen, Candlesticks, technischen Indikatoren, Fundamentaldaten, News, Risiko-Engine und KI-Einschätzung.
- Supabase-Struktur für Auth, Watchlists, Portfolio, Alerts, Entitlements und Notifications.
- PWA/Offline-Modus, rechtliche Hinweise, Mock-/Live-Trennung und robuste Fehlerantworten.

## Wichtige Gaps gegenüber Top-Anbietern

- Vollständige Realtime-Abdeckung aller Börsen erfordert lizenzierte Datenanbieter und Börsenrechte.
- Sehr tiefe Chart-Werkzeuge wie Drawing Tools, Pine-Script-ähnliche Strategien, Multi-Pane-Layouts und Social-Ideen fehlen noch.
- Professionelle Analysten-/Insider-/Earnings-/Guidance-Daten hängen von kostenpflichtigen APIs ab.
- Broker-Import, echte Depot-Synchronisation und Order-Funktionen sind noch nicht angebunden.
- Push-/E-Mail-/Webhook-Alerts brauchen einen Notification-Provider und ggf. Queue/Cron außerhalb von Vercel Hobby.

## Direkt umgesetzt

- Globale Suche wurde zur Asset-Autocomplete-Suche ausgebaut.
- Suchergebnisse greifen auf `/api/market/universe` zu und reichern verfügbare Treffer über `/api/market/quotes` mit Kursen an.
- Watchlist nutzt jetzt Live-/Polling-Quotes über `useMarketStream`.
- Watchlist-Refresh-Intervall wirkt jetzt tatsächlich auf Polling und UI-Status.
- Empty State für leere Watchlists ergänzt.
- ESLint ignoriert generierte Deploy-/Capacitor-Artefakte wie `.vercel`, `out` und `ios`.
- Typecheck, Lint und Production Build laufen erfolgreich.

## Betroffene Dateien

- `src/components/global-command-palette.tsx`
- `src/components/watchlist-sync-view.tsx`
- `src/components/market-boxes.tsx`
- `src/lib/use-market-stream.ts`
- `eslint.config.mjs`

## Noch fehlende oder optionale API Keys

- Polygon/Massive für breitere US-Realtime-/Snapshot-Abdeckung.
- Twelve Data für zusätzliche Aktien, ETFs, Forex und internationale Märkte.
- EODHD für globale Delayed-/EOD-/Fundamentalabdeckung.
- Databento für professionelle Tick-, Futures- und historische Daten.
- OpenAI oder ein eigener AI-Service für echte serverseitige KI-Analysen.
- Ein Notification-Provider wie Resend, Firebase/WebPush oder ein Queue-Worker für echte Alert-Zustellung.

## Nächste sinnvolle Schritte

1. Chart-Erlebnis weiter ausbauen: Vergleichscharts, Benchmark-Overlay, Indikator-Toggles und Zeichentools.
2. Screener professionalisieren: Spalten-Presets, gespeicherte Filter, Ranking-Modelle und Export.
3. Alert-System erweitern: echte Push/E-Mail/Webhook-Ausführung und Historie.
4. Portfolio-Modul vertiefen: Performance attribution, Dividendenkalender, Steuer-/Gebührenfelder und Broker-Import.
5. Provider-Fallbacks priorisieren: FMP-Rate-Limit umgehen, Polygon/Twelve/EODHD nach Plan und Lizenz aktivieren.

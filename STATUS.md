# StockPilot AI Status

Letzte Aktualisierung: 2026-08-06

## Aktueller Meilenstein

STAI wird schrittweise von einer Demo-Watchlist zu einem ehrlichen, providerbasierten Multi-Asset-Research-System ausgebaut.

## In diesem Meilenstein implementiert

- Probabilistischer Forecast Passport auf Asset-Detailseiten.
- Market Operations Cockpit im globalen Screener.
- Forecast-Ledger-API-Slice unter `/api/forecasts/[symbol]` mit Promotion-Gate, Daten-Cutoff, Modellversion, Input-Digest und Outcome-Plan.
- Supabase-Migration für `model_registry`, `forecasts`, `forecast_outcomes` und `model_evaluations` mit RLS, server-only Grants, Immutability-Trigger und pgTAP-Tests.
- Optionaler serverseitiger Supabase-Persistenzpfad für Forecast-Ledger-Antworten mit klarem Status `stored`, `duplicate`, `skipped` oder `failed`.
- Sichtbare Trennung von nutzbarer Kursabdeckung, Analysefreigabe, Lizenzbedarf, vorbereiteten Datenbereichen und Provider-Lücken.
- Tests gegen Mock-as-Live-Verwechslung, leere Provider-Ergebnisse, blockierte Analysezustände, blockierte Forecasts, Forecast-Ledger-RLS und Forecast-Persistenz-Fallback.

## Verifiziert

- `npm run lint` zuletzt erfolgreich.
- `npm run typecheck` zuletzt erfolgreich.
- `npm run lint` erfolgreich am 2026-08-06.
- `npm run typecheck` erfolgreich am 2026-08-06.
- `npm test` erfolgreich am 2026-08-06: 36 Testdateien, 150 Tests.
- `npm run build` erfolgreich am 2026-08-06.

## Bekannte Grenze

- `npx supabase test db` konnte lokal am 2026-08-06 nicht ausgeführt werden, weil keine lokale Postgres/Supabase-Instanz erreichbar war: `LegacyDbConnectError`.

## Offene Arbeiten

- Echte Provider-Verzeichnisse weiter ausbauen, besonders FMP/Finnhub/Twelve Data/EODHD/Polygon.
- Supabase-basierte persistente Instrument-Master-Synchronisation.
- Forecast Ledger mit späterem Outcome-Vergleich.
- Echte Aktivierung des Forecast-Schreibpfads setzt angewandte Supabase-Migration und serverseitige Supabase-Service-Konfiguration voraus.
- Provider-Entitlements und Lizenzmatrix weiter operationalisieren.
- iOS/Capacitor-Build separat auf Apple/Xcode-Seite prüfen.

## Externe Blocker

- Vollständige weltweite Realtime-Abdeckung benötigt kostenpflichtige Datenanbieter, Börsenlizenzen und explizite Anzeige-/Speicherrechte.
- App-Store-Release benötigt Apple-Developer-Zugang und rechtliche Freigabe der Finanzhinweise.

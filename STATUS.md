# StockPilot AI Status

Letzte Aktualisierung: 2026-08-06

## Aktueller Meilenstein

STAI wird schrittweise von einer Demo-Watchlist zu einem ehrlichen, providerbasierten Multi-Asset-Research-System ausgebaut.

## In diesem Meilenstein implementiert

- Probabilistischer Forecast Passport auf Asset-Detailseiten.
- Market Operations Cockpit im globalen Screener.
- Forecast-Ledger-API-Slice unter `/api/forecasts/[symbol]` mit Promotion-Gate, Daten-Cutoff, Modellversion, Input-Digest und Outcome-Plan.
- Supabase-Migration für `model_registry`, `forecasts`, `forecast_outcomes` und `model_evaluations` mit RLS, server-only Grants, Immutability-Trigger und pgTAP-Tests.
- Sichtbare Trennung von nutzbarer Kursabdeckung, Analysefreigabe, Lizenzbedarf, vorbereiteten Datenbereichen und Provider-Lücken.
- Tests gegen Mock-as-Live-Verwechslung, leere Provider-Ergebnisse, blockierte Analysezustände, blockierte Forecasts und Forecast-Ledger-RLS.

## Verifiziert

- `npm run lint` zuletzt erfolgreich.
- `npm run typecheck` zuletzt erfolgreich.
- `npm test` zuletzt erfolgreich: 35 Testdateien, 147 Tests.
- `npm run build` zuletzt erfolgreich.

## Bekannte Grenze

- `npx supabase test db` konnte lokal nicht ausgeführt werden, weil keine lokale Postgres/Supabase-Instanz erreichbar war: `LegacyDbConnectError`.

## Offene Arbeiten

- Echte Provider-Verzeichnisse weiter ausbauen, besonders FMP/Finnhub/Twelve Data/EODHD/Polygon.
- Supabase-basierte persistente Instrument-Master-Synchronisation.
- Forecast Ledger mit späterem Outcome-Vergleich.
- API-Schreibpfad vom Forecast-Ledger-Endpunkt in die neuen Supabase-Tabellen.
- Provider-Entitlements und Lizenzmatrix weiter operationalisieren.
- iOS/Capacitor-Build separat auf Apple/Xcode-Seite prüfen.

## Externe Blocker

- Vollständige weltweite Realtime-Abdeckung benötigt kostenpflichtige Datenanbieter, Börsenlizenzen und explizite Anzeige-/Speicherrechte.
- App-Store-Release benötigt Apple-Developer-Zugang und rechtliche Freigabe der Finanzhinweise.

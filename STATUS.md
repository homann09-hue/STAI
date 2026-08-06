# StockPilot AI Status

Letzte Aktualisierung: 2026-08-06

## Aktueller Meilenstein

STAI wird schrittweise von einer Demo-Watchlist zu einem ehrlichen, providerbasierten Multi-Asset-Research-System ausgebaut.

## In diesem Meilenstein implementiert

- Probabilistischer Forecast Passport auf Asset-Detailseiten.
- Market Operations Cockpit im globalen Screener.
- Forecast-Ledger-API-Slice unter `/api/forecasts/[symbol]` mit Promotion-Gate, Daten-Cutoff, Modellversion, Input-Digest und Outcome-Plan.
- Sichtbare Trennung von nutzbarer Kursabdeckung, Analysefreigabe, Lizenzbedarf, vorbereiteten Datenbereichen und Provider-Lücken.
- Tests gegen Mock-as-Live-Verwechslung, leere Provider-Ergebnisse, blockierte Analysezustände und blockierte Forecasts.

## Verifiziert

- TypeScript-Typecheck zuletzt erfolgreich.
- Vitest-Suite zuletzt erfolgreich.
- Next.js-Produktionsbuild zuletzt erfolgreich.

## Bekannte Grenze

- Lokales `npm run lint` hängt in dieser Umgebung nach Start von ESLint ohne konkrete Fehlermeldung. Das Projekt ist auf Node 22 gepinnt; die lokale Umgebung meldet aktuell ein anderes Node-Verhalten.

## Offene Arbeiten

- Echte Provider-Verzeichnisse weiter ausbauen, besonders FMP/Finnhub/Twelve Data/EODHD/Polygon.
- Supabase-basierte persistente Instrument-Master-Synchronisation.
- Forecast Ledger mit späterem Outcome-Vergleich.
- Provider-Entitlements und Lizenzmatrix weiter operationalisieren.
- iOS/Capacitor-Build separat auf Apple/Xcode-Seite prüfen.

## Externe Blocker

- Vollständige weltweite Realtime-Abdeckung benötigt kostenpflichtige Datenanbieter, Börsenlizenzen und explizite Anzeige-/Speicherrechte.
- App-Store-Release benötigt Apple-Developer-Zugang und rechtliche Freigabe der Finanzhinweise.

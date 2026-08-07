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
- Coverage-Intelligence im Marktuniversum: bewertet Kursabdeckung, Identität, Analysefähigkeit, Lizenzstatus, Mock-Schutz und Assetklassenbreite als sichtbaren Produktreife-Score.
- Sichtbare Trennung von nutzbarer Kursabdeckung, Analysefreigabe, Lizenzbedarf, vorbereiteten Datenbereichen und Provider-Lücken.
- Tests gegen Mock-as-Live-Verwechslung, leere Provider-Ergebnisse, blockierte Analysezustände, blockierte Forecasts, Forecast-Ledger-RLS, Forecast-Persistenz-Fallback und Coverage-Intelligence.

## Sicherheits- und Qualitätsfixes 2026-08-07

- Nutzerdaten laufen über einen RLS-gebundenen Supabase-Client statt über den
  Service-Role-Client. Mandantentrennung wird jetzt von der Datenbank erzwungen.
- Service-Role bleibt nur auf drei begründeten Pfaden: Portfolio-Trade-RPC,
  DSGVO-Export und Admin-Kontolöschung.
- Coverage misst mit `all: true` die gesamte Codebasis statt nur der von Tests
  importierten Dateien.
- Rate-Limit-Client-Key, `env.ts`-Schema, TS-Target, Node-Range und Lint-Scope
  korrigiert.

## Verifiziert

- `npm run typecheck` erfolgreich am 2026-08-07 nach den Sicherheitsfixes.
- `npm run lint` erfolgreich am 2026-08-07 nach den Sicherheitsfixes.
- Migrationen `20260711010000` und `20260806175532` am 2026-08-07 auf das
  Produktionsprojekt `STAI` angewendet. Alle 11 Migrationen sind jetzt aktiv.
- RLS-Isolation am 2026-08-07 direkt gegen Produktion getestet (Transaktion mit
  Rollback, zwei Testnutzer, keine Rueckstaende):
  - Zwei Zeilen in der DB, fuer den authentifizierten Nutzer nur eine sichtbar.
  - Fremdzeile eines anderen Nutzers nicht sichtbar.
  - `billing_events` und `forecasts` fuer `authenticated` gesperrt.
  - Insert auf fremde `user_id` blockiert.
- Supabase Security Advisor meldet null Findings; RLS ist auf allen Tabellen
  aktiv.
- `npm run lint` zuletzt erfolgreich.
- `npm run typecheck` zuletzt erfolgreich.
- `npm run lint` erfolgreich am 2026-08-06.
- `npm run typecheck` erfolgreich am 2026-08-06.
- `npm test` erfolgreich am 2026-08-06: 37 Testdateien, 153 Tests.
- `npm run build` erfolgreich am 2026-08-06.

## Bekannte Grenze

- `npx supabase test db` konnte lokal am 2026-08-06 nicht ausgeführt werden, weil keine lokale Postgres/Supabase-Instanz erreichbar war: `LegacyDbConnectError`.

## Offen nach den Fixes vom 2026-08-07

- `npm test`, `npm run test:coverage` und `npm run build` lokal ausführen. Die
  Coverage-Schwellen in `vitest.config.ts` sind bewusst niedrig und noch nicht
  kalibriert.
- Vor dem Deploy prüfen, dass `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` auch serverseitig gesetzt ist. Ohne den
  Schlüssel liefert `getSupabaseAuth` `missing_client` und alle Nutzerfunktionen
  fallen in den lokalen Demo-Modus.
- `npx supabase test db` bleibt offen. Die pgTAP-Suiten sind nicht gelaufen; der
  RLS-Nachweis stammt aus einem direkten Transaktionstest gegen Produktion.
- `src/lib/providers/market-provider.ts` (1.696 Zeilen) aufteilen. Bewusst nicht
  in diesem Durchgang gemacht, weil ein Refactor dieser Größe ohne lauffähige
  Testsuite nicht verantwortbar ist.
- Komponententests fehlen weiterhin vollständig (40 Komponenten, 0 Tests).

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

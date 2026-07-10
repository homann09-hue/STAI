# Realtime Intelligence Implementierungsplan

## Etappe 1: Vertikaler Schnitt

- [x] Gemeinsames Source-Adapter-Interface und Latenzklassen.
- [x] FMP Stock-News-Adapter mit Timeout, Retry, Backoff, Rate-Limit-Behandlung und Cursor.
- [x] SEC-EDGAR-Adapter für 8-K, 10-Q, 10-K, Form 4, 13D, 13G und 13F-HR.
- [x] Unveränderliche Raw Events und normalisierte Ereignisse.
- [x] Entity Resolution mit direkter Ticker-/CIK-Zuordnung und Schutz für mehrdeutige Symbole.
- [x] Mehrstufige Deduplizierung und unabhängige Quellenbestätigung.
- [x] Striktes Zod-Schema für Analyseantworten.
- [x] Deterministisches, nachvollziehbares Impact Scoring.
- [x] Watchlist-basierte interne Alerts mit deterministischen Critical-Regeln.
- [x] Intelligence Feed, Detailansicht und sichere Server-Routen.
- [x] RLS, Indizes, Retention und Tests.

## Etappe 2: Daten- und Queue-Ausbau

1. Unternehmensstammdaten mit CIK, ISIN, Börse, Land, Aliasen, Marken und Tochtergesellschaften zentralisieren.
2. Persistente Queue mit Lease, Dead-Letter-Queue und horizontalem Worker einführen.
3. FMP Press Releases als separaten Adapter ergänzen.
4. SEC Company Facts und vollständige Dokumentextraktion ergänzen, ohne ungeprüftes HTML an Modelle weiterzugeben.
5. Provider-Cursor je Symbol/CIK und priorisierte Watchlist-Batches ausbauen.
6. Distributed Rate Limits und Circuit Breaker über Upstash/Redis koordinieren.

## Etappe 3: Marktreaktion und Modellqualität

1. Ereigniszeit gegen Börsenkalender und Handelsphase normalisieren.
2. Kurse vor Veröffentlichung sowie 5, 15 und 60 Minuten danach erfassen.
3. Volumen- und Volatilitätsreaktion gegen historische Basis berechnen.
4. Look-ahead-Bias durch strikt zeitpunktbezogene Features verhindern.
5. Analysequalität mit Gold-Fixtures, Human-Review und Providervergleich messen.

## Etappe 4: Betrieb und Zustellung

1. Freigegebenen Cron-/Queue-Takt je Lizenz und Vercel-Plan aktivieren.
2. Push-/E-Mail-Zustellung mit Opt-in, Frequenzgrenzen und Zustellprotokoll ergänzen.
3. Dashboards für Providerfehler, Queue-Tiefe, Duplikatrate, Modellkosten und End-to-End-Latenz anbinden.
4. Retention-Jobs nach dokumentierter Anbieter- und Datenschutzfreigabe aktivieren.

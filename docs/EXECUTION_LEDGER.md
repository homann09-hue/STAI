# StockPilot AI Execution Ledger

Stand: 2026-08-17

## Aktueller Arbeitszustand

| Feld | Tatsaechlicher Stand |
| --- | --- |
| Phase | Phase 11: ECB, Analyse startet |
| Repository | `homann09-hue/STAI` |
| Main | `2189a9d2471eb95a40867592a37cd9345390839b` |
| PR | `#85`, gemergt |
| StockPilot Production | `https://stockpilot-ai-beta.vercel.app`, gesund, noch vor Phase 7 |
| Phase-7-Preview | `dpl_2pXDTqyxsc3oR6a2x5MagSwDnUTt`, READY |
| Vercel-Projekt | `stockpilot-ai`, ID `prj_gikdOwKQqTQ0wtrljGljwGcFfwzc` |
| BauPro | nicht veraendert und nicht deployt |

## Abgeschlossene Arbeit

- Alpaca-REST fuer Einzel-/Batch-Snapshots, letzte Trades, Market Clock und
  paginierte historische Bars mit explizitem Raw-Adjustment.
- Quote-/Trade-WebSocket mit Header-/Message-Auth, Subscribe,
  Mehrfachsymbolen, Reconnect, Resubscribe, Symbolgrenze, Backpressure,
  Prozess-Lease und REST-Fallback.
- Normalisierte Quotes, Trades und Bars mit Instrument-/Provideridentitaet,
  Venue, Feed, Zeitstempeln, Latenz und Qualitaetsproblemen.
- IEX bleibt als einzelner Handelsplatz markiert; SIP und Delayed SIP werden
  tarif- und qualitaetsgerecht getrennt.
- Secrets erscheinen nicht in URLs, Browserdaten, Cache-Keys oder Logs.
- Provider-Registry, Routing, Health, Ping, SSRF-Allowlist, Quoten und Circuit
  Breaker sind integriert.
- Lasttest meldet Transportfehler jetzt mit konkreter Ursache.

## Belegte Pruefungen

| Gate | Ergebnis |
| --- | --- |
| Format, TypeScript, ESLint | bestanden |
| Unit/Integration | 152 Dateien, 1.146 Tests bestanden |
| Coverage | 47,59 % Statements; 45,29 % Branches; 47,20 % Functions; 49,39 % Lines |
| Datenbank | 10 pgTAP-Dateien, 224 Tests bestanden |
| Browser/Mobile/Offline | 35 bestanden, 1 bewusster Skip |
| Production-Build | bestanden, 35 Seiten |
| Performance-Budget | 1.755.087 Bytes, unter 2 MiB |
| 2.000 aktive Sitzungen | 2.000/2.000, 0 Fehler, p95 391 ms |
| 10.000 Kapazitaetssitzungen | 10.000/10.000, 0 Fehler, p95 1.105 ms |
| Chaos/Security/Dependency | bestanden, 0 bekannte Schwachstellen |
| GitHub App-CI | `31969705043`, bestanden |
| GitHub pgTAP | `31969705114`, bestanden |

Die nicht-gatende Ein-Prozess-Spitzenprobe mit 2.000 sofortigen Requests
lieferte 1.927 erfolgreiche Antworten und 73 Test-Timeouts nach 15 Sekunden.
Das belegt die horizontale Skalierungsgrenze und ist kein bestandenes
2.000-Concurrent-Release-Gate. Der realistische 2.000-Aktivnutzerlauf ist
vollstaendig bestanden.

## Offene Blocker

### Vercel Production

`BLOCKED - EXTERNAL`: Direkter Production-Deploy und Promotion des fertigen
Preview-Artefakts antworten mit `api-deployments-free-per-day` nach mehr als
100 Deployments. Die bestehende Production bleibt HTTP 200 und traegt CSP,
HSTS, `nosniff`, Frame-Schutz und Referrer-Policy. Der Preview-Build wird
nicht unsicher mit Preview-Environment auf die Production-Aliase gelegt.

### Alpaca-Aktivierung

`BLOCKED - EXTERNAL`: Weder lokal noch im StockPilot-Vercel-Projekt sind
`ALPACA_API_KEY_ID` und `ALPACA_API_SECRET_KEY` vorhanden. Externe
Display-/Redistributionsrechte sind nicht bestaetigt. Der Adapter bleibt
deshalb fail-closed und erzeugt keine falsche Live-Anzeige.

## Naechster exakter Schritt

1. Vercel-Limit nach Ablauf des rollierenden Fensters erneut messen.
2. Manuellen Production-Workflow mit Ziel `production` und exakter
   StockPilot-Projektbindung ausfuehren.
3. Deployment-ID und Live-Alias pruefen.
4. Kernseiten, Health, Provider-Fail-Closed, DR, Enterprise, 2.000 aktive
   Sitzungen und Produktionslogs pruefen.
5. Production-Nachweis dokumentieren; Phase 7 erst danach bewerten.


### 2026-08-16 - Phase 8 Finnhub

- **Scope:** Finnhub als Kontroll- und Fallback-Provider, kein UI-Redesign und kein Vercel-Deployment.
- **Evidence:** Quote/Search/Profile/News/Earnings/Recommendations/Insider HTTP 200; Candles/Price Target/Economic Calendar HTTP 403; WebSocket-Verbindung erfolgreich, Markt geschlossen ohne Trade-Nachricht.
- **Decision:** Trade-WebSocket nicht als Quote-Stream ausgeben; tarifgesperrte Domains bleiben implementiert, antworten aber explizit mit `not_entitled`.
- **Security:** REST-Key aus URLs entfernt und auf allowgelisteten Server-Header umgestellt.
- **Verification:** Typecheck gruen, Lint ohne Warnungen, 156 Testdateien / 1.161 Tests gruen. Lokaler Build durch Workspace-I/O blockiert und nach Nutzerwunsch zeitbegrenzt abgebrochen; kein Build- oder Compilerfehler ausgegeben. Vercel verschoben.

### 2026-08-17 - Phase 9 SEC EDGAR (abgeschlossen)

- **Implementiert:** 10-K, 10-Q, 8-K, Form 4, SC 13D/13G, 13F-HR, S-1, 20-F und 6-K inklusive Berichtigungen; direkte CIK-Auflösung; historische Submission-Segmente; Metadaten; Deduplizierung; Neu-Erkennung; gemeinsames Fair-Access-Limit; strengere API-Filter.
- **Pipeline:** Die bestehende Intelligence-Persistenz nutzt die SEC-Aktennummer als externe ID und den Cursor zur Erkennung neuer Filings.
- **Verification:** Syntaxcheck der fünf geänderten TypeScript-Dateien und direkter SEC-Modultest mit 19 Funktions- und Sicherheitsprüfungen grün. GitHub-CI vollständig grün: TypeScript, ESLint, Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke, Performance-/Enterprise-Gates sowie Supabase-Migrationen, RLS und Integrität. Draft-PR `#87`.

### 2026-08-17 - Phase 10 FRED (abgeschlossen)

- **Katalog:** 23 offizielle US-Reihen für Leitzins, CPI/Kern-CPI, PCE/Kern-PCE, Arbeitsmarkt, Treasury-Laufzeiten, Zinskurve, M2, Produktion, Einzelhandel, Stimmung, Dollar, Öl und Liquidität.
- **Lebenszyklus:** Beobachtungsdatum, Erstveröffentlichung, Vintage-Stand, Erstwert und Revision sind getrennte Felder; NFP-Ableitungen rechnen auch den Erstwert als Monatsdifferenz.
- **Betrieb:** `FRED_API_KEY` aktiviert die offizielle JSON-API. Der offizielle CSV-Fallback bleibt ohne Schlüssel verfügbar, behauptet aber keine Vintage-Daten. Abrufe laufen gebündelt und zentral begrenzt.
- **Verification:** Syntaxcheck für 11 Dateien, direkter FRED-Modultest mit 19 Prüfungen und Diff-Hygiene grün. GitHub-CI vollständig grün: TypeScript, ESLint, Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke, Performance-/Enterprise-Gates sowie Supabase-Migrationen, RLS und Integrität. Draft-PR `#88`.

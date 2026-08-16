# StockPilot AI Execution Ledger

Stand: 2026-08-16

## Aktueller Arbeitszustand

| Feld | Tatsaechlicher Stand |
| --- | --- |
| Phase | Phase 7: Alpaca Realtime, technisch abgenommen, Production-Deploy offen |
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

# Financial Modeling Prep: Adaptervertrag

Stand: 2026-08-12

## Zweck

Financial Modeling Prep (FMP) ist in StockPilot ein spezialisierter, serverseitiger
Datenanbieter. FMP ist weder das alleinige Instrumentuniversum noch eine pauschale
Realtime-Quelle. Der aktive Tarif liefert nur belegte, symbolabhängig verfügbare
und als `delayed` gekennzeichnete Daten.

Alle produktiven FMP-Anfragen laufen ausschließlich über
`src/lib/providers/fmp-client.ts`. Der Browser erhält weder API-Schlüssel noch
Provider-Rohantworten.

## Sicherheits- und Betriebsvertrag

- Nur HTTPS und der Host `financialmodelingprep.com` sind zulässig.
- Nur explizit freigegebene Endpunkte und Parameter werden akzeptiert.
- `apikey` kann nie durch einen Aufrufer überschrieben werden.
- Symbole, Börsen, Perioden, Limits und Seiten werden vor dem Request validiert.
- Antworten werden mit Zod validiert, bevor sie einen Domänenadapter erreichen.
- Requests nutzen die gemeinsame Resilience-Schicht mit Timeout, Größenlimit,
  Deduplizierung, Provider-Budget, Retry und Circuit Breaker.
- Secrets erscheinen weder in Resultaten noch Fehlern oder Diagnosedaten.
- Fehlende Rechte, Quota-Probleme und ungültige Antworten enden fail-closed. Es
  werden keine Kennzahlen oder Kurse geschätzt.

## Freigegebene Endpunkte

| Domäne | FMP-Endpunkt | StockPilot-Nutzung |
|---|---|---|
| Kurs | `stable/quote` | verzögerter Kurs, nur bei nachgewiesener Symbolfreigabe |
| Historie | `stable/historical-price-eod/full` | Tageshistorie und Analysekontext |
| Profil | `stable/profile` | Unternehmensprofil und Marktkapitalisierung |
| Kennzahlen | `stable/ratios-ttm`, `stable/ratios`, `stable/key-metrics` | Übersicht, Zeitreihen und Bewertung |
| Abschlüsse | `stable/income-statement`, `stable/cash-flow-statement`, `stable/balance-sheet-statement` | Umsatz, Ergebnis, Cashflow und Bilanz |
| Suche | `stable/search-symbol`, `stable/search-name` | suchgetriebener Instrument Master |
| Corporate Actions | `stable/dividends`, `stable/splits` | Dividenden und Splits |
| Kalender | `stable/exchange-market-hours`, `stable/holidays-by-exchange` | Marktstatus und Handelskalender |
| Research | `stable/stock-peers`, `stable/grades-consensus`, `stable/price-target-summary` | Peers und Analystenkonsens, sofern tariflich verfügbar |
| News | `stable/news/stock`, `stable/news/general-latest` | interne Intelligence-Pipeline, sofern tariflich verfügbar |

Die Allowlist ist absichtlich enger als das FMP-Angebot. Ein neuer Endpunkt wird
erst ergänzt, wenn Datenvertrag, Rechte, Normalisierung, Tests und UI-Provenance
definiert sind.

## Standardisierte Fehler

| Code | Bedeutung | Verhalten |
|---|---|---|
| `configuration` | Schlüssel oder Basiskonfiguration fehlt | Provider nicht verfügbar |
| `invalid_request` | Endpunkt oder Parameter verletzt den Vertrag | Request wird vor dem Netzwerk blockiert |
| `authentication` | HTTP 401 | keine Wiederholung als Nutzerdatenfehler |
| `not_entitled` | HTTP 402/403 | Rechte-/Tarifhinweis, kein Mock-Fallback |
| `rate_limited` | HTTP 429 oder Provider-Budget erschöpft | zentraler Backoff/Fallback |
| `unavailable` | Timeout, Circuit Breaker oder HTTP 5xx | degradierter Zustand/Fallback |
| `invalid_response` | Antwort verletzt das Zod-Schema | Daten werden verworfen |

## Gemessene Tarifgrenzen

Die folgenden Ergebnisse sind am 2026-08-07 mit dem konfigurierten Tarif
gemessen und in `docs/BLOCKERS.md` ausführlich belegt:

- Verzeichnis-Endpunkte aus `v3` antworten mit HTTP 403.
- `stable/company-screener`, `stable/available-exchanges` und
  `stable/search-isin` antworten mit HTTP 402.
- `stable/search-symbol` und `stable/search-name` sind verfügbar.
- `stable/quote` ist symbolweise freigeschaltet und daher nicht heuristisch
  vorhersagbar.

Folgen:

- Das Instrumentuniversum wächst suchgetrieben und ist nicht vollständig.
- Kursverfügbarkeit wird je Instrument gemessen und gespeichert.
- FMP-Daten werden nie als „Live“ bezeichnet; der sichere Default ist
  `FMP_DATA_QUALITY=delayed`.
- Fehlen Daten oder Rechte, zeigt StockPilot `unavailable` statt Ersatzwerten.

## Erweiterungscheckliste

1. Produktrecht und Display-Recht belegen.
2. Endpunkt und erlaubte Parameter in der zentralen Allowlist ergänzen.
3. Rohantwort mit einem engen Zod-Schema validieren.
4. Providerdaten in ein StockPilot-Domänenmodell normalisieren.
5. Quelle, Abrufzeit, Qualitätsstatus und Datenlücken bis zur UI erhalten.
6. Erfolgs-, 401-, 402/403-, 429-, 5xx-, Timeout- und Schemafehler testen.
7. Regressionstest ergänzen, der direkte FMP-Aufrufe außerhalb des Clients
   verhindert.


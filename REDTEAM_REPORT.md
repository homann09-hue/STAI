# StockPilot AI Redteam Report

Datum: 2026-07-01  
Scope: STAI / StockPilot AI Web-App in `/Users/angelo/Documents/PWA-Akti`  
Nicht im Scope: BauPro und andere Projekte

## Ergebnis

StockPilot AI wurde auf produktionskritische Trust-, Safety-, Auth-, Mock-Daten-, UX-, Performance- und Build-Risiken geprüft und gehärtet. Die App trennt Demo-, Mock-, Offline-, Cached-, Delayed-, Near-Realtime- und Realtime-Zustände jetzt klarer. Kostenpflichtige Funktionen werden nicht mehr als aktiv dargestellt, solange kein echter Auth-/Billingstatus geprüft wurde.

Live-Status nach finalem Durchlauf: `https://stockpilot-ai-beta.vercel.app` ist auf das neue Vercel-Production-Deployment aliasiert und antwortet in Smoke-Checks mit HTTP 200.

## P0 Findings

Keine ungefixte P0-Schwachstelle gefunden.

## P1 Findings und Fixes

### P1: Mock-Daten konnten als ausreichend für belastbare Analyse-Signale gelten

Status: gefixt

Fix:
- `assessDataQuality` blockiert `sufficientForAnalysis`, wenn Daten `mock`, `unavailable` oder veraltet sind.
- Mock-Daten erzeugen sichtbare Warnungen.
- Risiko-Engine blockiert belastbare Analyse bei schwacher Datenqualität.

### P1: Billing-/Planstatus wirkte echter als technisch belegt

Status: gefixt

Fix:
- Neues Feature-Gate-Modell in `src/lib/feature-gates.ts`.
- Pricing zeigt `aktiv`, `Demo / nicht freigeschaltet`, `gesperrt` und `nicht verfügbar`.
- AppShell zeigt nicht mehr `Pro Plan`, sondern `Demo / kein Billingstatus`.

### P1: Watchlist-/Portfolio-/Alert-Mutations konnten lokal/Cloud missverständlich wirken

Status: gefixt

Fix:
- Client behandelt `401` bewusst als lokalen Demo-/Offline-Modus.
- Cloud-Sync wird nur als aktiv gezeigt, wenn die API `mode: supabase` liefert.
- Lokale Fallbacks werden sichtbar als lokal/Demo markiert.

## P2 Findings und Fixes

### P2: API-Rate-Limiter blockierte echte UI-/E2E-Request-Bursts zu früh

Status: gefixt

Fix:
- Read- und Mutation-Buckets wurden getrennt.
- Sichere Lese-Bursts wurden erhöht, damit Dashboard, Offline-Cache, E2E und mehrere sichtbare Widgets nicht gegenseitig blockieren.
- Schreibaktionen bleiben weiter deutlich strenger limitiert.
- Unsafe-Input-Validierung wird nicht mehr durch vorherige GET-Bursts verdeckt.

### P2: News konnten wie echte Meldungen wirken

Status: gefixt

Fix:
- Mock-News erhalten sichtbares `MOCK`-Badge.
- Mock-News enthalten Warnhinweis: nicht als echte Nachricht oder Fakt interpretieren.
- Externe Links werden nur bei echter URL angezeigt.

### P2: Unfertige Seiten wirkten teilweise wie Platzhalter

Status: gefixt

Fix:
- `TerminalSectionView` zeigt jetzt Produktstatus, Erklärung und Datenstatus.
- Indizes, Kalender, Analysen, Backtesting und Screener liefern Nutzen plus klaren Provider-/Lizenzstatus.

### P2: Alert-Modell war nicht klar genug getrennt von echter Ausführung

Status: gefixt

Fix:
- Alert-Regeln haben optionale Status-, Frequenz- und Kanal-Felder.
- Lokale Alerts zeigen `Demo / nicht aktiv`.
- UI erklärt, dass lokale Alerts keine Push-/E-Mail-/Webhook-Ausführung haben.

### P2: Client-Eingaben waren nicht überall vor lokaler Verarbeitung normalisiert

Status: gefixt

Fix:
- `normalizeSymbolInput` ergänzt.
- Watchlist blockiert Duplikate, leere Eingaben, zu lange Symbole und Sonderzeichen.
- Alert-/Portfolio-Texte blockieren HTML-Startzeichen `<` gegen XSS-nahe Eingaben.
- Portfolio/Delete IDs werden stärker validiert.

### P2: Offline/localStorage konnte bei Quota/Parsing-Problemen werfen

Status: gefixt

Fix:
- `saveOfflineValue` und `readOfflineValue` fangen Storage-Fehler ab.
- Kaputte JSON-Werte werden sicher ignoriert und bereinigt.
- Große Offline-Payloads werden begrenzt.

### P2: Refresh-Optionen waren zu aggressiv für kostenlose Provider

Status: gefixt

Fix:
- UI-Intervalle reduziert auf 10s, 30s, 60s, 5min.
- Watchlist zeigt Rate-Limit-Hinweis und sichtbare Render-Begrenzung für große Listen.

## P3 Findings und Fixes

### P3: Deutsche Texte und Umlaute waren uneinheitlich

Status: gefixt

Fix:
- Sichtbare deutsche Texte korrigiert.
- `npm run qa:grammar` meldet keine fehlenden Umlaute oder blockierten Begriffe.

### P3: Datenqualitätslabels waren nicht zentral

Status: gefixt

Fix:
- Neue zentrale UI-Komponenten:
  - `DataQualityBadge`
  - `DataQualityNotice`
- Unterstützte sichtbare Stati: `REALTIME`, `NEAR_REALTIME`, `DELAYED`, `CACHED`, `MOCK`, `OFFLINE`, `ERROR`, `MARKET CLOSED`, `HISTORICAL`.

## Geprüfte Seiten

- `/`
- `/markets`
- `/stocks`
- `/etfs`
- `/crypto`
- `/indices`
- `/screener`
- `/watchlist`
- `/portfolio`
- `/alerts`
- `/news-terminal`
- `/calendar`
- `/analyses`
- `/backtesting`
- `/learn`
- `/pricing`
- `/settings`

## Security / Supabase

Status: geprüft

Live-Projekt: STAI (`ircuakhftjcwttwegyac`)

Finaler Live-Migrationsstand:
- `stockpilot_initial_schema`
- `add_apply_portfolio_trade_rpc`
- `add_product_readiness_tables`

Neu live auf STAI:
- `portfolios`: RLS aktiv, 4 Policies
- `notifications`: RLS aktiv, 4 Policies
- `entitlements`: RLS aktiv, 1 Policy

RLS-Check:
- `profiles`: RLS aktiv, Policies vorhanden
- `watchlists`: RLS aktiv, Policies vorhanden
- `alert_rules`: RLS aktiv, Policies vorhanden
- `portfolio_positions`: RLS aktiv, Policies vorhanden
- `analysis_snapshots`: RLS aktiv, Policies vorhanden
- `portfolio_transactions`: RLS aktiv, Policies vorhanden
- `alert_events`: RLS aktiv, Policies vorhanden
- `portfolio_snapshots`: RLS aktiv, Policies vorhanden
- `data_provider_status`: RLS aktiv, Read-Policy vorhanden

Service-Role bleibt serverseitig. Keine API-Keys wurden in Client-Code verschoben.

## Tests ergänzt oder verschärft

- Datenqualität blockiert Mock-Signale.
- Feature-Gates zeigen Paid-Funktionen nicht aktiv ohne Billing.
- Watchlist-/Symbolvalidierung gegen XSS-nahe Eingaben.
- Alert- und Portfolio-Payloads blockieren HTML-Startzeichen.
- Portfolio-Berechnungen bleiben getestet.
- Risk-Engine-Test isoliert Datenqualität bewusst.

## Abschlusschecks

Lokal bestanden:
- `npm run qa:redteam`

Enthaltene Checks:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm run test:load`
- `npm run qa:grammar`
- `npm run audit:moderate`
- `npm run audit:safe`

Zusätzlich geprüft:
- Supabase RLS live auf STAI
- Vercel Production Build mit Production-Settings
- Vercel Production Deploy
- Live-Smoke-Checks gegen `https://stockpilot-ai-beta.vercel.app`
- Vercel Error-Log-Scan: keine Error-Logs gefunden

Load-Test Ergebnis:
- 1, 10, 25, 50, 100 und 200 parallele Requests
- 0 rejected
- 0 failed HTTP/slow
- alle Statuscodes 200

Live-Smoke Ergebnis:
- `/`: HTTP 200
- `/api/health`: HTTP 200
- `/api/market/overview`: HTTP 200
- `/api/providers/health`: HTTP 200
- `/api/providers/ping`: HTTP 200
- `/api/alerts/run` ohne Secret: HTTP 401

## Offene Risiken / braucht Backend oder Anbieter

- Echte Billing-/Abo-Durchsetzung braucht Stripe/LemonSqueezy/Vercel Marketplace oder eigenes Billing.
- Alert-Ausführung läuft auf Vercel Hobby als täglicher Cron. Häufigere Ausführung wie alle 15 Minuten braucht Vercel Pro oder externen Cron/Queue.
- Push/E-Mail/Webhook-Kanäle für Alerts brauchen noch einen Notification-Provider.
- Echte News brauchen providerseitige Quelle, Link, Zeitstempel, Rate-Limits und Quellenvalidierung.
- Vollständige Realtime-Abdeckung aller Börsen braucht lizenzierte Anbieter und Börsenrechte.
- Große Watchlists sollten langfristig echte Virtualisierung erhalten.
- Portfolio braucht für Live-Depots Broker-/Custodian-Import oder manuelle Transaktionshistorie mit Audit-Trail.
- FMP ist live erreichbar, aber aktuell providerseitig rate-limited/degraded. Fallbacks greifen, aber FMP-Plan/Limit sollte geprüft werden.

## Nächste konkrete Schritte

1. Code committen und pushen.
2. Billing-Provider auswählen und Feature-Gates serverseitig erzwingen.
3. Alert-Kanäle für Push/E-Mail/Webhook ergänzen.
4. FMP-Limit/Plan prüfen oder providerseitigen Fallback priorisieren.
5. Optional auf Vercel Pro upgraden, wenn Alert-Cron öfter als täglich laufen soll.
6. Providerstrategie für News/Fundamentals finalisieren.

# StockPilot AI Status

Letzte Aktualisierung: 2026-08-10

## Aktueller Meilenstein

Der aktuelle Meilenstein stabilisiert den browserseitigen Supabase- und
Billing-Lebenszyklus. Pro App-Laufzeit wird genau ein Auth-Client verwendet;
identische parallele Statusabfragen werden zusammengefuehrt, ohne Ergebnisse
ueber den laufenden Request hinaus zwischenzuspeichern.

## Aktuell umgesetzt

- Admin-, Konto-, Tarif-, Kosten- und Entitlement-Funktionen in PR #25.
- Transparente Datenqualitaet mit Provider, Zeitstempel, Latenz und
  Analysefreigabe.
- RLS-gebundene Nutzerdaten; Service Role nur auf dokumentierten Serverpfaden.
- Probabilistischer Forecast-Ledger mit Baseline und Outcome-Evaluation.
- Instrument Master mit gemessener statt geratener Kursverfuegbarkeit.
- CI fuer Typecheck, Lint, Coverage, Build, E2E, Performance, Security,
  Lizenzen, Evidenz und Datenbankkontrollen.
- Woechentlicher Red-Team-Lauf und halbstuendliches Live-Monitoring.
- Fest auf Commit-SHAs gepinnte GitHub Actions.
- Supabase-Advisor-Fixes fuer RLS-InitPlan, Fremdschluessel-Indizes und den
  technischen Primaerschluessel von `provider_usage`.

## Produktionsstand

- Produktionsadresse: https://stockpilot-ai-beta.vercel.app
- Produktionsstand vor diesem Meilenstein: `f505051` auf `main`.
- Dieser Meilenstein benoetigt keine Datenbankmigration und veraendert weder
  BauPro noch dessen Deployment.
- `MOCK`, `DELAYED`, `CACHED`, `OFFLINE` und `UNAVAILABLE` bleiben sichtbar;
  es gibt keinen stillen Mock-as-Live-Fallback.

## Externe Grenzen

- Der aktive FMP-Tarif liefert kein vollstaendiges Instrumentverzeichnis und
  sperrt einzelne Symbole ohne ableitbare Regel.
- Globale Realtime-Daten benoetigen passende Anbieter- und Boersenlizenzen.
- Shared Cache/Rate-Limiting benoetigt eine konfigurierte Upstash-/Redis-
  Instanz.
- App-Store-Release benoetigt Apple-Developer-Zugang und Signierung.
- Ein kommerzieller Start in Deutschland benoetigt rechtlich gepruefte AGB,
  Widerrufsbelehrung und Datenlizenzfreigaben.

## Naechster Freigabeschritt

1. Singleton- und Request-Deduplizierungs-Tests ausfuehren.
2. Typecheck, Lint, Gesamttests und Produktionsbuild pruefen.
3. Den isolierten StockPilot-Branch ueber GitHub- und Vercel-Gates freigeben.
4. Produktionsdeployment und Auth-/Billing-Smoke-Test pruefen.

# Milestone 2026-08-10: stabiler Supabase-Browser-Lebenszyklus

- Supabase erzeugt pro Browser-Laufzeit nur noch einen GoTrue-Client fuer die
  aktive, sichere Public-Konfiguration.
- Identische parallele Auth-GETs liefern unabhaengig lesbare Responses aus
  genau einem Netzwerkaufruf; externe Ziele erhalten nie Authorization-Header.
- Billing-Entitlements werden nur waehrend eines laufenden Requests
  dedupliziert, nicht veraltet zwischengespeichert.
- Das Billing-Panel verwendet dieselbe gepruefte Client-Abstraktion fuer
  Entitlements und sichere Stripe-Portal-Weiterleitungen.
- Verifiziert: Formatpruefung, Typecheck und Lint gruen; 112 Testdateien mit
  952 Tests gruen; Next.js-Produktionsbuild mit 35 statischen Seiten gruen.
# Milestone 2026-08-10: dynamic catalog and production data integrity

- Static mini-universe removed from universal search and screener data paths.
- Provider search and Instrument Master now form one catalog service.
- Production dashboards no longer overlay verified quotes onto mock content.
- Missing provider data fails closed and an incomplete catalog no longer emits
  an unproven "instrument not found" response.
- Typecheck, lint, 906 tests, build, E2E, 2,000-user load, chaos, 10,000-session
  capacity, enterprise controls and iOS sync passed.
- External restrictions and complete evidence: `docs/RELEASE_REPORT.md` and
  `docs/GITHUB_GOAL_AUDIT_2026-08-10.md`.

# Milestone 2026-08-10: historical-series integrity

- Backtests distinguish provider-adjusted, raw, mixed and unavailable price
  bases instead of silently treating every close as corporate-action adjusted.
- Mixed adjusted/raw histories are blocked; provider-adjusted close is used
  only at 100 percent row coverage.
- Data cutoff, received timestamp, UTC basis, adjusted-close coverage and
  missing point-in-time vintages are machine-readable and visible in the UI.
- Survivorship, selection, look-ahead and corporate-action limitations remain
  explicit; no historical data is invented or silently repaired.

# Milestone 2026-08-10: keine synthetischen Marktreihen in Produktion

- Sieben im Dashboard fest eingebaute Index-/Kryptokurse entfernt. Die
  Tickerleiste enthält jetzt ausschließlich Einträge aus den gelieferten
  Providerlisten und darf bei fehlender Abdeckung leer bleiben.
- Mathematisch erzeugte Benchmark-Kerzen aus der Asset-Seite entfernt. Der
  Schalter ist bis zu belastbaren Benchmarkdaten sichtbar deaktiviert.
- Reine, getestete Auswahlfunktion schützt die Dashboard-Reihenfolge,
  Deduplizierung und den leeren Providerfall.
- Gap-Matrix mit aktuellem Code-, Test-, Sicherheits- und Produktstand
  abgeglichen; widersprüchliche und veraltete Behauptungen korrigiert.

# Milestone 2026-08-10: belegter Markt- und Ereigniskalender

- Statische Demo-Termine vollständig aus dem Produktionskalender entfernt.
- Corporate-Action-Ledger als einzige serverseitige Ereignisquelle integriert;
  die suchgetriebene, unvollständige Abdeckung bleibt sichtbar.
- Börsenzeiten und Feiertage über eine gecachte, rate-limit-geschützte
  Provider-Schicht normalisiert. Der Sitzungsstatus wird nur bei vollständiger
  Evidenz berechnet und fällt sonst auf `unknown` zurück.
- API-Routen, mobile Kalenderansicht sowie Domain-, API- und UI-Tests ergänzt.

# Milestone 2026-08-10: corporate-action ledger

- Dokumentierte FMP-Endpunkte für Dividenden und Splits sind hinter einem
  normalisierten, serverseitigen Provider-Adapter angebunden.
- Ereignisse tragen kanonische ID, Typ, Termine, Betrag/Verhältnis, Quelle,
  Qualitätsstatus, fachlichen Datenstand und Eingangszeitpunkt.
- Der neue Supabase-Ledger ist idempotent, RLS-geschützt und nur serverseitig
  beschreibbar; Assetseiten zeigen Abdeckung und Ausfälle ohne Ersatzwerte.
- Symboländerungen, Fusionen und Delistings bleiben sichtbar offen, bis eine
  belastbare und lizenzierte Quelle angebunden ist.

# Milestone 2026-08-10: wirksame Analyse-Tiefe

- Die Zielgruppen-Auswahl in den Einstellungen ist jetzt eine zentrale,
  browserweit synchronisierte Präferenz statt eines isolierten Schalters.
- Onboarding und Zielgruppen-Auswahl verwenden dieselbe Modus-Quelle und können
  sich nicht mehr widersprechen.
- Asset-Seiten staffeln Bewertungsmodelle, Vergleichsdaten, regulatorische
  Quellen und Modell-Governance für Anfänger, Fortgeschrittene und Profis.
- Risiko-, Datenqualitäts- und Abdeckungshinweise bleiben unabhängig vom Modus
  sichtbar; der Modus ist eine Darstellungspräferenz, kein Tarif-Gate.

# Milestone 2026-08-10: deterministische Zeitdarstellung

- Alle betroffenen servergerenderten Datums- und Zeitangaben verwenden eine
  explizite Produkt-Zeitzone statt die lokale Zeitzone des Renderers.
- Vercel-SSR und Browser erzeugen dadurch denselben Text; ein im Live-Smoke-Test
  gefundener React-Hydration-Fehler ist mit einem Regressionstest abgesichert.
- Direkte Restformatierungen in Corporate Actions, Notifications, Portfolio,
  Alerts, Intelligence und Profi-Ansichten wurden ebenfalls auf den zentralen
  Formatter umgestellt.

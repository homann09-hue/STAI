# StockPilot AI Status

## Wahrheitsgetreue News- und Providerherkunft

- Echte News von Marketaux, NewsAPI oder weiteren verlinkten Quellen werden in
  der zentralen Datenqualitätsprüfung nicht mehr pauschal als Mock-News
  bezeichnet.
- Gemischte Provider- und Fixture-News bleiben getrennt nachvollziehbar;
  Fixture-Anteile sperren eine entscheidungsreife Analyse.
- Fehlende Marktdaten-, Fundamentals- und News-Provider fallen im
  Provider-Kontrollzentrum auf `unavailable` statt auf suggerierte
  Mock-Fallbacks.
- Die tatsächlich aktive deterministische Evidence Engine wird als solche
  ausgewiesen; externe KI-Keys werden nicht länger als aktive Funktion
  behauptet.
- Regressionstests sichern echte, gemischte und fehlende Quellenzustände ab.
- Verifiziert: Formatprüfung, Typecheck, vollständiger Lint, 124 Testdateien
  mit 988 Tests, Next.js-Produktionsbuild mit 35 Seiten sowie 35 bestandene
  Browser-E2E-Tests; ein plattformabhängiger Test wurde bewusst übersprungen.

## Echte Nutzerzustände statt Mock-Portfolio und Mock-Alerts

- Portfolio- und Alert-Seiten starten ohne Beispielpositionen oder
  Beispielregeln; unauthentifizierte APIs liefern leere lokale Nutzerzustände.
- Lokale Portfolioeingaben und Offline-Snapshots bleiben nutzbar, werden aber
  nicht als brokerbestätigt oder als Supabase-Daten dargestellt.
- Die lokale Alert-Prüfung verwendet keine erfundenen Kurs-, RSI-, Volumen-
  oder Risikowerte mehr. Ohne echten Worker bleibt jede aktive Regel sichtbar
  `unavailable` und kann nicht scheinbar ausgelöst werden.
- Auch leere authentifizierte Konten zeigen ihren echten Supabase-Status statt
  in einen Demo-Zustand zurückzufallen.

## Produktions-Fail-Closed für News und Fundamentaldaten

- News- und Fundamentals-Provider fallen bei fehlenden Schlüsseln, leeren
  Antworten, Rate-Limits oder Fehlern nicht mehr auf Mock-Fixtures zurück.
- `STOCKPILOT_*_PROVIDER=mock` ist nur bei lokal erlaubten
  Entwicklungs-Fixtures wirksam; Vercel Production erzwingt immer
  `unavailable` statt Ersatzdaten.
- Teilweise Fundamentals tragen feldweise Provider- oder
  `unavailable`-Provenienz. Fehlende Kennzahlen werden nicht aus Fixtures
  ergänzt und nicht als verifiziert analysiert.
- README und Deployment-Anleitung verwenden nun sichere `auto`-Defaults statt
  produktiver Mock-Konfiguration.
- Verifiziert: Formatprüfung, Typecheck, vollständiger Lint, 124 Testdateien
  mit 986 Tests und Next.js-Produktionsbuild mit 35 Seiten erfolgreich.

## Konsistente Asset-Detailanalyse

- Asset-Detailseiten bewerten Kurs, Historie, News und Fundamentaldaten jetzt als getrennte, dynamische Evidenz-Layer.
- Geladene echte Historien und externe News werden nicht länger durch statische Texte als fehlend bezeichnet.
- Die sichtbare KI-Analyse und die Wahrscheinlichkeiten der Detailseite nutzen dieselbe deterministische Evidenzanalyse wie die geschützte Analyse-API.
- Bei unzureichender Evidenz werden Wahrscheinlichkeiten auf der Detailseite zurückgehalten statt aus einem einzelnen Tagesquote abgeleitet.
- Der Analysis-Guard aktualisiert seinen Quellenstatus dynamisch und hinterlässt bei ausreichender Historie keinen widersprüchlichen „Historie fehlt“-Hinweis.
- Verifiziert am 2026-08-10: Formatprüfung, Typecheck, Lint, 114 Testdateien mit 958 Tests und der Next.js-Produktionsbuild sind erfolgreich.

## Quellengebundene Analyse statt produktivem Mock-Provider

- Die produktive `/api/ai/analysis`-Route nutzt standardmäßig eine deterministische Evidenzanalyse aus der realen Asset-Pipeline.
- Mock-Analysen sind nur noch erlaubt, wenn Entwicklungs-Fixtures ausdrücklich zulässig sind; eine Produktionskonfiguration mit `STOCKPILOT_AI_PROVIDER=mock` fällt sicher auf die Evidenzanalyse zurück.
- Wahrscheinlichkeiten werden aus mindestens 60 verifizierten Kurskerzen, gemessenen Renditen und historischer Volatilität abgeleitet und bleiben konservativ begrenzt.
- Bei Mock-, Stale- oder unzureichenden Daten antwortet die API mit einem klaren Blockierstatus statt einer scheinpräzisen Analyse.
- Quellen, Daten-Cutoff, Qualitätswert, Konfidenz, Modellversion, Unsicherheit und Datenlücken werden im Provider-Ergebnis mitgeführt.
- Verifiziert am 2026-08-10: Formatprüfung, Typecheck, Lint, 114 Testdateien mit 958 Tests und der Next.js-Produktionsbuild sind erfolgreich.

## Provider-Evidenz statt pauschaler Datenlücke

- Echte historische Kursreihen und externe News werden im realen Provider-Pfad jetzt als eigene Evidenzquellen bewertet.
- Eine begrenzte technische Analyse wird nur bei mindestens 60 verwertbaren Kerzen, einer nutzbaren Historienintegrität und einer nicht veralteten, nicht simulierten Kursbasis freigegeben.
- Fehlende verifizierte Fundamentaldaten bleiben ausdrücklich sichtbar; technische Evidenz wird nicht zu einer vollständigen Unternehmensanalyse hochgestuft.
- Delayed-Kurse, fehlende Corporate-Action-Nachweise und fehlende externe News erzeugen transparente Einschränkungen statt falscher Vollständigkeit.
- Die neue Bewertungslogik ist I/O-frei und mit Negativ-, Positiv- und Stale-Fällen getestet.
- Verifiziert am 2026-08-10: Formatprüfung, Typecheck, Lint, 113 Testdateien mit 955 Tests und der Next.js-Produktionsbuild sind erfolgreich.

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

# Milestone 2026-08-10: feldweise verifizierte Fundamentaldaten

- Der Asset-Pfad lädt Fundamentals parallel zu Historie und News und führt sie
  mit expliziter Feldprovenienz bis in Datenqualität und Analyse.
- Nur Felder mit bestätigtem Providerstatus werden übernommen; Mock- und
  Fallbackwerte werden vor der produktiven Asset-Ausgabe entfernt.
- Ein vom Kursanbieter belegter Market Cap darf separat genutzt werden, ohne
  andere fehlende Unternehmenskennzahlen vorzutäuschen.
- Datenqualitätsquellen, Abdeckungsquote, Langfristhinweis und KI-Treiber
  unterscheiden jetzt vollständige, teilweise und fehlende Fundamentals.
- Anbieterquoten für Wachstum und Dividendenrendite werden einheitlich auf die
  sichtbare Prozent-Skala normalisiert; Dezimalquoten erscheinen nicht mehr um
  den Faktor 100 zu klein.
## 2026-08-11 - Evidenzgebundene Scores und ehrliche Verlaufsdarstellung

- Quote-only-, Mock- und nicht belegte Asset-Zeilen liefern keine nutzbaren Analyse-Scores mehr.
- Trend, Technik, News, Fundamentaldaten und Risiko tragen Verfügbarkeit, Konfidenz, Quellen, Zeitpunkt und Begründung.
- Der Gesamt-Score entsteht nur bei ausreichender Kurs-, Risiko- und Kontextevidenz; fehlende Dimensionen werden nicht neutral aufgefüllt.
- Risiko misst jetzt tatsächlich historisches Risiko. Ein höherer Risikowert erhöht nicht mehr den Chancen-Gesamtscore.
- Synthetische Mini-Charts aus einem einzelnen Kursstand wurden aus Dashboard und Marktterminal entfernt.
- Detailseite, Dashboard, Profi-Report, Portfolio-Demo und Modellallokation zeigen bei fehlender Evidenz `n/a` oder halten die Auswertung zurück.
- Komponenten- und Domänentests decken fehlende Evidenz sowie zurückgehaltene Wahrscheinlichkeiten ab.
## 2026-08-11 - Historische Risiko-Engine und Entfernung synthetischer Profi-Daten

- Neue deterministische Historical-Risk-Engine berechnet Rendite, annualisierte Volatilität, Downside-Volatilität, Maximum Drawdown, Sharpe, Sortino, Calmar sowie historischen VaR und CVaR.
- Jede Berechnung trägt Provider, Datenstand, Stichprobengröße, Mindestmenge und Modellannahmen; unter 60 Renditen oder bei gescheiterter Historienintegrität bleiben alle Werte `n/a`.
- Die Asset-Detailseite zeigt die neuen Kennzahlen mit Quellen- und Grenzhinweisen.
- Feste ETF-Performance-, Sharpe-, Drawdown-, Holdings-, Sektor- und Stammdatenwerte wurden aus dem Profi-Provider entfernt.
- Abgeleitete Fake-Fundamentals, Krypto-Supply-Werte, Mock-News, Demo-Portfolio-Kennzahlen, statische Vergleiche und Mock-Indexstände wurden entfernt oder fail-closed auf nicht verfügbar gesetzt.
- Der Profi-Report bezieht sein Dashboard jetzt aus dem aktiven Marktprovider und besitzt kein eigenes hartcodiertes 15-Symbol-Universum mehr.
- Gezielte Quant-, Komponenten- und Provider-Tests: 3 Dateien mit 7 Tests erfolgreich; TypeScript und gezielter Lint erfolgreich.

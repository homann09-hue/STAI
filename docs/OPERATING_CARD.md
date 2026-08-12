# StockPilot AI Operating Card

Stand: 2026-08-12

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar verlässlichen, schnellen, sicheren und verständlichen Finanzanalyseprodukt entwickelt. Datenkorrektheit, Stabilität, Sicherheit und Erklärbarkeit stehen vor Funktionsumfang. Keine Analyse verspricht sichere Gewinne oder verschleiert Unsicherheit.

## Aktuelle Phase

- **Phase 2:** kanonische Instrument-, Quote- und Bar-Domainmodelle.
- Kanonisches Instrumentenmodell: abgeschlossen und produktiv belegt.
- Kanonisches Quote-Modell: abgeschlossen und produktiv belegt.
- Nächster einzelner Arbeitspunkt: kanonisches Bar-/Kerzenmodell.

## Verbindliche Qualitätsregeln

- Keine erfundenen Marktdaten, Kennzahlen, Quellen oder Währungen.
- Kein stiller Mock-Fallback und keine unbelegte Echtzeitkennzeichnung.
- Jeder Datenpunkt behält Provider, fachlichen Datenstand, Eingangszeit und Qualitätsstatus.
- Unzureichende, stale, divergente oder ungültige Evidenz sperrt aktuelle Analysen.
- Deterministische Berechnungen statt LLM-Rechenlogik; Prognosen bleiben probabilistisch.
- Nutzerdaten laufen standardmäßig über tokengebundene Supabase-Clients und RLS.
- Secrets bleiben serverseitig; Providerzugriffe nutzen die zentrale abgesicherte Fetch-Schicht.
- BauPro niemals verändern oder deployen. Vercel-Aktionen dürfen ausschließlich das Projekt `stockpilot-ai` adressieren.

## Aktuelle externe Blocker

- FMP bietet im aktiven Tarif kein vollständiges Instrumentverzeichnis und sperrt Quotes symbolweise.
- Vollständige Realtime-, Börsen- und Display-Rechte erfordern passende Datenverträge.
- Ein verteilter Produktionscache benötigt eine konfigurierte Redis-/Upstash-Instanz.
- Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang und Signierung.
- Kommerzieller Start benötigt rechtlich geprüfte Texte und bestätigte Datenlizenzen.

## Definition of Done je Arbeitspunkt

Implementierung, Typecheck, Lint, Unit-/Integrationstests, relevante Datenbank- und Browserprüfungen, Produktionsbuild, Security-/Regressionsprüfung, Dokumentation, Commit, Push, CI, StockPilot-Deployment, reale Produktionsprüfung und Fehlerlogkontrolle müssen belegt sein. Erst danach beginnt der nächste Punkt.

## Aktueller Produktionsnachweis

- Main: `75ac1052839f4a8bb60625421c07c825db4843b6`
- Deployment: `dpl_CNqvdkS78XHgo7MyVVKe3gBkVNSp`, READY
- Live: `https://stockpilot-ai-beta.vercel.app`
- Main-CI: `31556173755`, erfolgreich
- Main-Datenbanktests: `31556173724`, erfolgreich
- Live-Quote-Stichprobe: FMP-Aktien `DELAYED`; Binance-BTC `NEAR_REALTIME/PARTIAL`; keine unbelegte Echtzeit
- Produktionsfehlerlog: leer

## Arbeitsregeln

Zu jedem Aufgabenstart diese Karte und `docs/EXECUTION_LEDGER.md` lesen. Echten Repository-, CI-, Datenbank- und Live-Stand messen, statt zu raten. Bestehende Architektur erweitern, keine Parallelarchitektur bauen. Externe Grenzen ehrlich dokumentieren und unabhängige Arbeit fortsetzen.

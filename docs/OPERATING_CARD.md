# StockPilot AI Operating Card

Stand: 2026-08-12

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar verlässlichen, schnellen, sicheren und verständlichen Finanzanalyseprodukt entwickelt. Datenkorrektheit, Stabilität, Sicherheit und Erklärbarkeit stehen vor Funktionsumfang. Keine Analyse verspricht sichere Gewinne oder verschleiert Unsicherheit.

## Aktuelle Phase

- **Phase 2 abgeschlossen:** kanonische Instrument-, Quote- und Bar-Domainmodelle.
- Instrument- und Quote-Modell sind produktiv belegt.
- Bar-Modell, Qualitäts- und Analyse-Gates sind implementiert, lokal/CI geprüft und produktiv deployt.
- Finaler Live-Bar-Inhaltstest: `BLOCKED – EXTERNAL`, weil der aktive FMP-Tarif aktuell kein geprüftes Symbol mit zugleich verfügbarer Quote und Historie liefert.
- Nächster einzelner Arbeitspunkt: **Phase 3 – Provider Registry und Routing**.

## Verbindliche Qualitätsregeln

- Keine erfundenen Marktdaten, Kennzahlen, Quellen oder Währungen.
- Kein stiller Mock-Fallback und keine unbelegte Echtzeitkennzeichnung.
- Jeder Datenpunkt behält Provider, fachlichen Datenstand, Eingangszeit und Qualitätsstatus.
- Ungeklärte Instrument-ID/Währung, unzureichende, stale, divergente oder ungültige Evidenz sperrt aktuelle Analysen.
- Deterministische Berechnungen statt LLM-Rechenlogik; Prognosen bleiben probabilistisch.
- Nutzerdaten laufen standardmäßig über tokengebundene Supabase-Clients und RLS.
- Secrets bleiben serverseitig; Providerzugriffe nutzen die zentrale abgesicherte Fetch-Schicht.
- BauPro niemals verändern oder deployen. Vercel-Aktionen dürfen ausschließlich das Projekt `stockpilot-ai` adressieren.

## Aktuelle externe Blocker

- FMP bietet im aktiven Tarif kein vollständiges Instrumentverzeichnis und sperrt Quotes symbolweise; der Live-Bar-Inhaltstest ist deshalb derzeit nicht reproduzierbar.
- Vollständige Realtime-, Börsen- und Display-Rechte erfordern passende Datenverträge.
- Ein verteilter Produktionscache benötigt eine konfigurierte Redis-/Upstash-Instanz.
- Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang und Signierung.
- Kommerzieller Start benötigt rechtlich geprüfte Texte und bestätigte Datenlizenzen.

## Definition of Done je Arbeitspunkt

Implementierung, Typecheck, Lint, Unit-/Integrationstests, relevante Datenbank- und Browserprüfungen, Produktionsbuild, Security-/Regressionsprüfung, Dokumentation, Commit, Push, CI, StockPilot-Deployment, reale Produktionsprüfung und Fehlerlogkontrolle müssen belegt sein. Extern unmögliche Live-Nachweise werden mit Messwert, Auswirkung und Aktivierungsschritt als `BLOCKED – EXTERNAL` dokumentiert.

## Aktueller Produktionsnachweis

- Main: `02c245cfc92cf475dc865873a37d12f7895279c0`
- Deployment: `dpl_G2F3HnTSWX7rGD2YpyjorN3xyFFp`, READY
- Live: `https://stockpilot-ai-beta.vercel.app`
- Main-CI: `31558970326`, erfolgreich
- Main-Datenbanktests: `31558970332`, erfolgreich
- Lokal: 137 Testdateien / 1.052 Tests; Build 35 Seiten; E2E 35 bestanden / 1 bewusst übersprungen
- Live: Kernseiten und Health 200; AAPL korrekt `quote_not_entitled`; SPY/MSFT/NVDA korrekt `identity_unverified`
- Produktionslog im Prüfzeitraum: nur erwartete `info`-Requests, keine Runtime-Fehler

## Arbeitsregeln

Zu jedem Aufgabenstart diese Karte und `docs/EXECUTION_LEDGER.md` lesen. Echten Repository-, CI-, Datenbank- und Live-Stand messen, statt zu raten. Bestehende Architektur erweitern, keine Parallelarchitektur bauen. Externe Grenzen ehrlich dokumentieren und unabhängige Arbeit fortsetzen.

## Phase-3-Betriebskarte — Provider Routing (2026-08-12)

- Verbindliche Registry: `src/lib/providers/provider-registry.ts`.
- Verbindliche Rechtebeschreibung: `docs/DATA_PROVIDER_RIGHTS.md`.
- Produktion/Preview ist für externe Providerdaten standardmäßig fail-closed.
- Eine Freigabe braucht gemeinsam:
  `MARKET_DATA_ALLOW_EXTERNAL_DISPLAY=true`,
  `MARKET_DATA_LICENSE_VERIFIED_PROVIDERS`,
  `MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS` und einen dokumentierten
  `MARKET_DATA_LICENSE_VERIFIED_AT`-Zeitpunkt.
- `VERCEL_ENV=production|preview` und `NODE_ENV=production` können durch
  `MARKET_DATA_ENV=development` nicht heruntergestuft werden.
- Der geschützte Provider-Health-Endpunkt liefert den secret-freien Snapshot
  als `marketDataRouting`.
- Fehlende Rechte, fehlende Konfiguration, fehlende Capability, deaktivierte
  Adapter und offene Circuit Breaker bleiben getrennte Gründe.
- Aktive Produktion: `dpl_ERhonfRua42y6NqVrFxpkHdv956z`,
  `https://stockpilot-ai-beta.vercel.app`.

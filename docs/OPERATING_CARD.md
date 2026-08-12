# StockPilot AI Operating Card

Stand: 2026-08-12

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar verlässlichen, schnellen, sicheren und verständlichen Finanzanalyseprodukt entwickelt. Datenkorrektheit, Stabilität, Sicherheit und Erklärbarkeit stehen vor Funktionsumfang. Keine Analyse verspricht sichere Gewinne oder verschleiert Unsicherheit.

## Aktuelle Phase

- **Phase 4 abgeschlossen:** Caching, Rate Limits und Circuit Breaker.
- Alle HTTP-Providerzugriffe laufen durch eine gemeinsame Resilience-Schicht.
- Cachefenster, Budgets, Retry, Backoff, Parallelität und Circuit-Zustände sind typisiert, getestet und produktiv belegt.
- Horizontale, instanzübergreifende Koordination bleibt `BLOCKED – EXTERNAL`, bis dediziertes Upstash/Redis für StockPilot konfiguriert ist; lokal bleibt der Prozesscache funktional.
- Nächster einzelner Arbeitspunkt: **Phase 5 – FMP-Adapter härten**.

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

- Main: `b03819dd4d3ebd34b5d361ee3e9d4c15fcd94c40`
- Deployment: `dpl_BjDt1QudE7J8an8T85yTeJn8BS3D`, READY
- Live: `https://stockpilot-ai-beta.vercel.app`
- Main-CI: `31566452682`, erfolgreich
- Main-Datenbanktests: `31566452673`, erfolgreich
- Lokal: 145 Testdateien / 1.105 Tests; Build 35 Seiten; Enterprise- und Grammatik-Gates bestanden
- Last: 2.000 aktive Nutzer ohne Fehler, `p95` 484 ms; Release-Gate bis 200 gleichzeitig ohne Fehler; 500er-Probe 500/500 HTTP 200
- Live: DR, PWA/Offline, Kernseiten, Health und FMP-Pfade geprüft; fehlende Providerrechte ehrlich leer/`unavailable`
- Produktionslog im Prüfzeitraum: keine Runtime-Fehler

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

## Phase-4-Betriebskarte — Provider Resilience (2026-08-12)

- Verbindliche Policies: `src/lib/resilience-policy.ts`.
- Verbindliche Laufzeit: `src/lib/provider-resilience.ts`.
- Keine Wiederholung für 401/402/403, Lizenz-, Symbol- oder Eingabefehler.
- Begrenzte Wiederholung nur für Netzwerk, Timeout, 408/429 und 5xx.
- `Retry-After` wird respektiert; lange Wartezeiten blockieren keine
  Serverless-Funktion.
- Pro Provider gelten eigenes Budget, Burst, Parallelität, Warteschlange und
  Circuit. Ein offener Provider blockiert keinen anderen.
- Im Half-open-Zustand ist exakt ein Recovery-Probe zulässig.
- Geteilte Koordination ist erst bei `cache.sharedConfigured=true`
  instanzübergreifend; ohne Upstash bleibt sie pro Prozess.
- Aktive Produktion: `dpl_BNgRtaHEupghcb6XgXX2PjiNm7fj`,
  `https://stockpilot-ai-beta.vercel.app`.

## Phase-5-Betriebskarte — FMP-Adapter (2026-08-12)

- Verbindlicher Client: `src/lib/providers/fmp-client.ts`.
- Verbindlicher Vertrag und Tarifmatrix: `docs/FMP_ADAPTER.md`.
- Kein FMP-Netzwerkzugriff außerhalb des zentralen Clients.
- Nur allowlist-basierte Endpunkte und Parameter; Antworten werden vor der
  Domänennormalisierung validiert.
- FMP bleibt `delayed`; Quote-Verfügbarkeit wird pro Symbol gemessen und ist
  nicht heuristisch vorhersagbar.
- Instrumentabdeckung bleibt suchgetrieben und unvollständig.
- Ohne belegte Display-Rechte liefern öffentliche Pfade `unavailable`; es
  gibt keinen Mock- oder Schätzfallback.
- Cachezustand überschreibt keine fehlende Datenqualität. Eine gecachte
  Leerantwort bleibt `unavailable`.
- DR und Lasttests akzeptieren Degraded-Betrieb nur, wenn betroffene Symbole
  explizit benannt und keine Mock-Symbole enthalten sind.
- Aktive Produktion: `dpl_BjDt1QudE7J8an8T85yTeJn8BS3D`,
  `https://stockpilot-ai-beta.vercel.app`.
- Nächster einzelner Arbeitspunkt: **Phase 6 — Twelve Data**.

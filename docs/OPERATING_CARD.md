# StockPilot AI Operating Card

Stand: 2026-08-12

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar verlässlichen, schnellen, sicheren und verständlichen Finanzanalyseprodukt entwickelt. Datenkorrektheit, Stabilität, Sicherheit und Erklärbarkeit stehen vor Funktionsumfang. Keine Analyse verspricht sichere Gewinne oder verschleiert Unsicherheit.

## Aktuelle Phase

- **Phase 6 abgeschlossen:** Twelve Data.
- Adapter, Normalisierung, Routing, Suche, Quotes, Batch, Historie,
  Marktstatus und tariflich gesperrtes Streaming sind implementiert, lokal,
  in CI und in Produktion fail-closed geprüft.
- Produktion enthält bewusst keinen Twelve-Schlüssel und keine ungeprüfte
  Display-Freigabe. Der technische Adapter ist produktiv, der externe Feed
  bleibt bis zum Vertrag deaktiviert.
- Nächster einzelner Arbeitspunkt: **Phase 7 – Alpaca Realtime**.

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
- Für Twelve Data fehlen in StockPilot-Produktion ein eigener API-Schlüssel,
  ein bestätigter Tarif sowie belegte externe Display-/Redistributionsrechte.
  Der Adapter bleibt deshalb in Produktion fail-closed.
- Vollständige Realtime-, Börsen- und Display-Rechte erfordern passende Datenverträge.
- Ein verteilter Produktionscache benötigt eine konfigurierte Redis-/Upstash-Instanz.
- Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang und Signierung.
- Kommerzieller Start benötigt rechtlich geprüfte Texte und bestätigte Datenlizenzen.

## Definition of Done je Arbeitspunkt

Implementierung, Typecheck, Lint, Unit-/Integrationstests, relevante Datenbank- und Browserprüfungen, Produktionsbuild, Security-/Regressionsprüfung, Dokumentation, Commit, Push, CI, StockPilot-Deployment, reale Produktionsprüfung und Fehlerlogkontrolle müssen belegt sein. Extern unmögliche Live-Nachweise werden mit Messwert, Auswirkung und Aktivierungsschritt als `BLOCKED – EXTERNAL` dokumentiert.

## Aktueller Produktionsnachweis

- Phase-6-Laufzeitcommit: `425c4163f2565a565c39db48420ac89df6940bf1`
- Deployment: `dpl_GknMoY35ArrDnps6Ri2HTCrs3iVa`, READY
- Live: `https://stockpilot-ai-beta.vercel.app`
- Main-CI: `31569858919`, erfolgreich
- Main-Datenbanktests: `31569858893`, erfolgreich
- Lokal: 149 Testdateien / 1.129 Tests; Build 35 Seiten; 35 E2E
  bestanden / 1 bewusster Skip; Enterprise-, Institutional- und
  Grammatik-Gates bestanden
- Last: 2.000 aktive Nutzer ohne Fehler, `p95` 485 ms; Release-Gate bis
  200 gleichzeitig ohne Fehler; 500er-Probe 500/500 HTTP 200
- Live: DR, PWA/Offline, Kernseiten, Health, Twelve-Fail-Closed und
  geschützte Provider-Pings geprüft; keine Mock-Ersatzdaten
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

## Phase-6-Betriebskarte — Twelve Data (2026-08-12)

- Verbindlicher Client: `src/lib/providers/twelve-data-client.ts`.
- Verbindliche Normalisierung:
  `src/lib/providers/twelve-data-normalization.ts`.
- REST-Zugriffe nutzen ausschließlich Header-Authentifizierung, eine feste
  Host-/Endpunkt-Allowlist, die gemeinsame Resilience-Schicht und validierte
  Antworten. Schlüssel erscheinen weder in öffentlichen Daten noch Logs.
- Quote, echtes Batch, Instrumentensuche/-auflösung, historische Bars und
  Marktstatus sind zentral angebunden. Fehlende Werte wie Bid/Ask, Währung,
  Volumen oder bekannte Verzögerung werden nicht erfunden.
- Streaming ist standardmäßig deaktiviert und an Tarif-/Symbolgrenzen
  gebunden. Reconnect, Resubscribe, Heartbeat, Backpressure und sauberes
  Listener-Aufräumen sind getestet; REST-Polling bleibt der ehrliche Fallback.
- Der kostenlose Basic-Tarif wird nicht als externer Produktionsfeed
  freigegeben. Ein offizieller Demo-Smoke belegt lokal nur die technische
  Kompatibilität von Suche, Quote und Historie, keine kommerziellen Rechte.
- Lokale Freigabe: 149 Testdateien / 1.129 Tests, 35 E2E bestanden / 1 Skip,
  Build 35 Seiten, Coverage 46,83 %, Performance-Budget 1.714 KiB,
  Enterprise 99/100 und Institutional 28/28.
- Last: 2.000 aktive Sitzungen ohne Fehler, `p95` 360 ms; Release-Gate bis
  500 gleichzeitig ohne Fehler. Die 1.000-/2.000-Spitzenprobe hatte jeweils
  74 Client-Timeouts und ist ausdrücklich kein bestandenes Release-Gate.
- PR #83 wurde als `425c4163f2565a565c39db48420ac89df6940bf1`
  gemergt. Main-CI und Datenbanktests sind erfolgreich.
- Produktion `dpl_GknMoY35ArrDnps6Ri2HTCrs3iVa` ist READY. Live-Smoke, DR,
  Enterprise, 2.000 aktive Sitzungen sowie Error-/500-/Warning-Logscan sind
  erfolgreich; BauPro blieb unberührt.
- Nächster einzelner Arbeitspunkt: **Phase 7 — Alpaca Realtime**.

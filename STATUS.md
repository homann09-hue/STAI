# StockPilot AI Status

## 2026-08-12 – Phase 6: Twelve Data abgeschlossen

- Twelve Data ist als zentraler serverseitiger Adapter für Suche,
  Instrumentauflösung, Quote, echtes Batch, historische Bars, Marktstatus und
  tariflich gesperrtes Streaming integriert.
- REST-Schlüssel bleiben in Headern und ausschließlich serverseitig; Host,
  Endpunkte, Parameter und Antworten werden validiert. Fehler, Quoten und
  fehlende Rechte bleiben getrennt und secret-frei.
- Daten werden ohne erfundene Bid/Ask-, Volumen-, Währungs- oder Delaywerte
  normalisiert. Listingidentität, MIC, Land, Zeitzone und Providerherkunft
  bleiben bis Instrument Master, API und UI erhalten.
- Streaming ist standardmäßig deaktiviert. Reconnect, Resubscribe, Heartbeat,
  Backpressure und Listener-Cleanup sind getestet; REST-Polling ist der
  kontrollierte Fallback.
- Lokal bestanden: Format, TypeScript, ESLint, 149 Testdateien mit 1.129 Tests,
  Coverage, Build mit 35 Seiten, 35 Browserflüsse bei 1 bewusstem Skip,
  Dependency-/Lizenz-/Sprachprüfung, Performance- und Enterprise-Gates.
- 2.000 aktive Sitzungen liefen ohne Fehler (`p95` 360 ms); das Release-Gate
  bis 500 gleichzeitige Anfragen blieb fehlerfrei. Je 74 Timeouts bei den
  nicht-gatenden 1.000-/2.000-Einzelprozess-Spitzen sind dokumentiert.
- Ein lokaler Smoke mit dem offiziellen Demo-Key belegt Suche, Quote und
  Historie technisch, aber weder einen Produktionsschlüssel noch externe
  Nutzungsrechte.
- PR #83 ist als Main-Commit `425c4163f2565a565c39db48420ac89df6940bf1`
  gemergt. PR- und Main-CI sowie beide isolierten Datenbankworkflows sind grün.
- StockPilot-Deployment `dpl_GknMoY35ArrDnps6Ri2HTCrs3iVa` ist READY und
  bedient `https://stockpilot-ai-beta.vercel.app`. Fehlende Rechte bleiben
  live als leerer/unavailable Zustand ohne Mock-Fallback sichtbar.
- Live-DR und Enterprise-Gate bestehen. Provider-Pings bleiben öffentlich
  geschützt; kein anonymer Request verbraucht Twelve-Quota.
- 2.000 aktive Produktionssitzungen liefen ohne Fehler (`p95` 485 ms); die
  500er-Spitzenprobe lieferte 500/500 HTTP 200 bei 14 langsamen Antworten.
- Vercel meldete nach Smoke und Last keine Error-, 500- oder Warning-Logs.
- Twelve-Produktionsschlüssel, Tarif und externe Displayrechte bleiben
  `BLOCKED – EXTERNAL`; der technische Adapter ist produktiv, der Feed aus.
- BauPro blieb unberührt. Nächster einzelner Arbeitspunkt: Phase 7 – Alpaca
  Realtime.

## 2026-08-12 – Phase 4: Caching, Rate Limits und Circuit Breaker

- Eine zentrale Resilience-Laufzeit schützt sämtliche HTTP-Providerzugriffe mit providerbezogenen Budgets, Burst-Grenzen, begrenzter Parallelität und Warteschlangen.
- Netzwerkfehler, Timeouts, HTTP 408/429 und 5xx werden nur begrenzt mit Backoff, Jitter und `Retry-After` wiederholt. 401/402/403, Lizenz-, Symbol- und Eingabefehler werden nicht wiederholt.
- Wiederholte transiente Fehler öffnen einen geteilten Circuit Breaker. Nach Ablauf darf exakt ein Half-open-Prüfabruf starten; Provider bleiben voneinander isoliert.
- Identische gleichzeitige Providerabfragen werden gebündelt. Der gemeinsame Cache nutzt atomare Zähler, besitzersichere Sperren, begrenzte Upstash-Laufzeiten und fachlich typisierte Cachefenster bis 30 Tage.
- Quotes, Assets, Dashboard, Fundamentals, News, Makro, Analysen, Forecasts und Professional-Daten tragen explizite Cacheklassen; geschützte Health-Diagnosen zeigen nur aggregierte Resilience-Zustände ohne URLs oder Secrets.
- Lokal belegt: Typecheck, Lint, 142 Testdateien / 1.082 Tests, Build mit 35 statischen Seiten, E2E 35 bestanden / 1 bewusst übersprungen, Stress und Chaos bestanden.
- Lastnachweis: 2.000 aktive Sitzungen, 0 abgelehnte und 0 fehlerhafte Antworten, `p95` 367 ms, maximal 444 ms. 500 gleichzeitige Release-Gate-Anfragen ebenfalls ohne Fehler.
- GitHub: PR #76 gemergt; Main `a9de16bfe9a633283b8199764dca702939e13874`. PR-CI `31563071386`, PR-DB `31563071330`, Main-CI `31563261983` und Main-DB `31563262143` erfolgreich.
- Produktion: `dpl_BNgRtaHEupghcb6XgXX2PjiNm7fj`, READY, Alias `https://stockpilot-ai-beta.vercel.app`; Kernseiten und APIs HTTP 200, keine Runtime-Fehler im Prüfzeitraum.
- BauPro blieb unverändert. Nächster einzelner Arbeitspunkt: Phase 5 – FMP-Adapter härten.

## 2026-08-12 – Phase 2: Kanonisches Bar-/Kerzenmodell

- Verbindlicher NormalizedBar-Vertrag mit Instrument, Provider, Intervall, UTC-Grenzen, OHLCV, Trade Count, VWAP, Währung, Provenienz und Qualitätsstatus.
- RAW, SPLIT_ADJUSTED, DIVIDEND_ADJUSTED und SPLIT_DIVIDEND_ADJUSTED sind getrennte, validierte Zustände.
- FMP-Zeilen mit fehlendem oder widersprüchlichem OHLCV werden verworfen; Duplikate, falsche Intervalle, Zukunftszeiten und gemischte Bereinigungsarten werden erkannt.
- Analyse und Backtest bleiben bei ungeklärter Identität, Währung, Divergenz oder inkonsistenter Bereinigung geschlossen.
- Synthetische Marktband-Sparklines wurden entfernt; fehlende Historie wird sichtbar als fehlend dargestellt.
- Lokal belegt: Typecheck, Lint, 137 Testdateien / 1.051 Tests, Build mit 35 statischen Seiten, E2E 35 bestanden / 1 bewusst übersprungen.
- GitHub: PR #70 und Live-Gate-Fix #71 gemergt; Main `02c245cfc92cf475dc865873a37d12f7895279c0`.
- Main-CI `31558970326` und Datenbanktests `31558970332` erfolgreich.
- Produktion: `dpl_G2F3HnTSWX7rGD2YpyjorN3xyFFp`, READY, Alias `https://stockpilot-ai-beta.vercel.app`.
- Live-Fail-closed belegt; echter Provider-Bar-Inhaltstest aktuell `BLOCKED – EXTERNAL` durch symbolweise FMP-Tarifgrenze.


## Aktueller Meilenstein: Phase 2 - Kanonisches Quote-Modell abgeschlossen

Stand: 2026-08-12

- Ein zentraler, providerunabhängiger Quote-Vertrag transportiert Instrument-, Provider-, Provider-Symbol-, Venue-, Preis-, Größen-, Zeit-, Feed- und Qualitätsprovenienz bis zur API und UI.
- `isRealtime` wird ausschließlich bei belegtem Realtime-Feed, gemeldeter Null-Verzögerung, vorhandenem Event-Zeitstempel und zulässigem Qualitätsstatus gesetzt.
- Die Qualitätszustände `OK`, `DELAYED`, `STALE`, `DIVERGENT`, `PARTIAL`, `MARKET_CLOSED`, `PROVIDER_DEGRADED`, `UNAVAILABLE` und `INVALID` sind zentral normalisiert. Ein erkannter Fehler kann beim erneuten Normalisieren nicht verschwinden.
- Nullkurse, gekreuzte Bid-/Ask-Werte, negative Volumina und zukünftige Zeitstempel werden verworfen oder als ungültig gesperrt. Fehlende Währungen bleiben `XXX`; es wird kein USD erfunden.
- REST-, Stream-, Provider-, Analyse- und UI-Pfade verwenden denselben Vertrag. Unzureichende Quote-Qualität sperrt aktuelle Analyseaussagen.
- Lokal belegt: TypeScript, ESLint, 132 Testdateien mit 1.025 Tests, Produktionsbuild mit 35 Seiten sowie 35 bestandene Browserflüsse und ein bewusster Skip.
- Pull Request #68 wurde als `75ac1052839f4a8bb60625421c07c825db4843b6` gemergt. PR-CI `31555878371`, PR-Datenbanktests `31555878466`, Main-CI `31556173755` und Main-Datenbanktests `31556173724` sind erfolgreich.
- Produktionsdeployment `dpl_CNqvdkS78XHgo7MyVVKe3gBkVNSp` ist READY und bedient `https://stockpilot-ai-beta.vercel.app`.
- Live belegt: Startseite, Märkte, AAPL und Health liefern HTTP 200. FMP-Aktien sind `DELAYED`; Binance-BTC ist `NEAR_REALTIME/PARTIAL`; keine Stichprobe behauptet unbelegte Echtzeit. Das Produktionsfehlerlog war leer.
- Es gab keine Datenbankmigration. Ausschließlich `stockpilot-ai` wurde veröffentlicht; BauPro blieb unberührt.
- Nächster einzelner Arbeitspunkt: kanonisches Bar-/Kerzenmodell.

## Aktueller Meilenstein: Phase 1 - DSGVO-Export-Mandantengrenze

Stand: 2026-08-11

- Der DSGVO-Export wird vollständig auf den tokengebundenen Supabase-Nutzerclient umgestellt.
- `billing_events` bleibt unveränderliche, servergeschriebene Evidenz; angemeldete Nutzer erhalten ausschließlich SELECT auf eigene Zeilen über RLS.
- Die Service Role bleibt in `user-data.ts` nur noch für administrative Kontolöschung.
- pgTAP und Code-Regressionstests sichern Leserechte, Schreibverbote und Mandantentrennung.
- Lokal belegt: Format, Typecheck, Lint, 129 Testdateien mit 1.005 Tests, 10 pgTAP-Suiten mit 207 Prüfungen, Produktions-Build mit 35 statischen Seiten sowie 35 bestandene Browserflüsse und ein bewusster Skip.
- GitHub-, Migrations- und Produktionsnachweise folgen nach den externen Gates.

## Aktueller Meilenstein: Phase 1 - Auth-Privilegiengrenze abgeschlossen

Stand: 2026-08-11

- Normale Authentifizierung wird ausschließlich über den tokengebundenen Supabase-Publishable-Key-Client validiert.
- `AuthResult` transportiert keinen Service-Role-Client mehr durch Watchlist-, Alert-, Portfolio- oder Billing-Pfade.
- Die Service Role wird nur noch lokal und fail-closed für DSGVO-Export und administrative Kontolöschung erzeugt.
- Ein Sicherheitsregressionstest schützt diese Grenze dauerhaft.
- Lokal belegt: Format, Typecheck, Lint, 129 Testdateien mit 1.004 Tests, Produktions-Build mit 35 statischen Seiten sowie 35 bestandene Browserflüsse und ein bewusster Skip.
- Pull Request #57 wurde als `3ceac72` gemergt; Main-CI `31518017780` und Datenbanktests `31518017734` sind grün.
- Produktionsdeployment `dpl_5a5ih8TAvs1mqcJE8ND8RC8iwAeq` ist READY und bedient `stockpilot-ai-beta.vercel.app`.
- Dashboard, Health, Watchlist, Portfolio und Einstellungen liefern HTTP 200; anonyme und ungültige Sessions bleiben ohne Cloud-Sync im lokalen Modus.
- Das Produktionsfehlerlog war im Prüfzeitraum leer. BauPro blieb unberührt.

## Aktueller Meilenstein: Phase 1 - Portfolio-Trade-Mandantengrenze abgeschlossen

Stand: 2026-08-11

- `apply_portfolio_trade` wird vom Service-Role-Pfad auf den tokengebundenen Nutzerclient umgestellt.
- Die Datenbank leitet den Eigentümer aus `auth.uid()` ab; die API übergibt keine `user_id` mehr.
- Die alte RPC-Signatur wird entfernt; direkte Aufrufe erhalten dieselben Eingabegrenzen wie die API.
- Mandantentrennung, Atomarität und Eingabegrenzen sind lokal mit 31 Portfolio-pgTAP-Prüfungen belegt; alle 10 Datenbanksuiten bestehen mit 201 Prüfungen.
- Die vollständigen Gates bestehen mit 128 Testdateien und 1.001 Tests, 35 Browserflüssen, einem bewussten Skip sowie einem Produktions-Build mit 35 Seiten.
- Ein gefundener Hydration-Race ist behoben: Das lokale Transaktionsformular wird erst nach Initialisierung interaktiv und 5/5 parallele Desktop-Durchläufe bestehen.
- Pull Request #55 wurde als `6df7f4e` gemergt; Main-CI und Datenbanktests sind auf diesem Stand grün.
- Produktionsmigration `20260811193000` ist angewendet. Nur die neue `auth.uid()`-gebundene `SECURITY INVOKER`-Signatur existiert; `anon`, `service_role` und `public` besitzen kein Ausführungsrecht.
- StockPilot-Deployment `dpl_H6FXaQ35nnYeLcw2bbxgJMUm9Cqg` ist READY. Vier Kernziele liefern HTTP 200, der Live-Portfoliofluss ist grün und das Fehlerlog leer.
- BLOCKER-012 bleibt getrennt als externe Supabase-Produktionskonfiguration offen.

## Aktueller Meilenstein: Phase 0 - Marktreife-Baseline

Stand: 2026-08-11

- Der verbindliche Projektplan ist `docs/ULTIMATE_MARKET_READINESS_GOAL.md`.
- Der knappe aktuelle Arbeitsstand ist `docs/EXECUTION_LEDGER.md`.
- Baseline belegt: Format, Typecheck, Lint, 124 Testdateien mit 988 Tests, Build mit 35 statischen Seiten sowie 35 erfolgreiche E2E-Tests und 1 bewusster Skip.
- GitHub-CI, Datenbanktests, Live-Monitoring und vier Produktions-Smokes sind vor der Phase-0-Änderung grün.
- Alte Statusabschnitte unterhalb dieses Abschnitts bleiben als historische Nachweise erhalten und sind nicht die aktuelle Steuerungsquelle.

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

## Phase 1 - validierter Zwischenstand (2026-08-11)

- Mandantengebundene Feature-Quoten sind im Anwendungscode und in der neuen Migration umgesetzt.
- Lokal bestanden: Format, TypeScript, ESLint, 125 Vitest-Dateien mit 990 Tests, Produktions-Build und 35 Playwright-Tests; 1 mobiler Duplikatlauf ist bewusst übersprungen.
- `npm audit` meldet 0 bekannte Schwachstellen. Enterprise-Check: 99/100 ohne gesetzte Live-URL. Institutional-Check: 28/28.
- Die neue pgTAP-Suite enthält exakt 29 Assertions. Die Ausführung bleibt bis zum GitHub-Datenbankworkflow offen, weil lokal keine Docker-Supabase-Instanz läuft.

## Phase 1 - Quoten-Mandantentrennung abgeschlossen (2026-08-11)

- Pull Request #51 wurde als Merge-Commit c2e43c6 in main übernommen.
- StockPilot CI und Database Tests sind auf dem Merge-Stand vollständig grün.
- Produktionsmigration 20260811154426 ist angewendet; nur consume_feature_quota(text, integer) existiert.
- Die RPC bindet den Mandanten an auth.uid(); authenticated darf ausführen, anon und service_role nicht.
- Produktion dpl_9rgmGDqW9BqmW3BkJJBmkryKLMab ist READY und über https://stockpilot-ai-beta.vercel.app erreichbar.
- Live-Smoke: Startseite, Health, AAPL, News und Provider-Status jeweils HTTP 200; Vercel-Fehlerlog leer.
- Phase 1 bleibt aktiv. Nächster einzelne Arbeitspunkt ist die Auth-/Passwort-Härtung aus BLOCKER-012.

## Phase 1 - Auth-/Passwort-Härtung in Prüfung (2026-08-11)

- Passwort-Reset verlangt jetzt zwei identische sichere Eingaben und blockiert Tippfehler vor dem Provider-Aufruf.
- Formularfelder verknüpfen Hilfen und Fehler über ARIA; Erfolg und Fehler werden assistiven Technologien angekündigt.
- App und lokale Supabase-Konfiguration erzwingen konsistent mindestens 10 Zeichen; ein Drift-Test sichert die Übereinstimmung.
- Lokale Supabase-Konfiguration aktiviert secure_password_change.
- Lokal bestanden: Format, TypeScript, ESLint, 127 Testdateien mit 998 Tests, Build mit 35 Seiten und 35 Browser-Tests; 1 Lauf bewusst übersprungen.
- Die Web-App ist als Deployment dpl_6LXiqnVm5rurCwWZfVn95xfkFTAD live; Supabase-Produktionsschalter und Leaked-Password-Protection bleiben extern offen.

### Produktionsnachweis Auth-UI

- Pull Request #53 wurde als Merge 3871420 in main übernommen.
- Main-CI und Database Tests sind auf diesem Merge-Stand vollständig grün.
- Reset-Seite und Health-Endpunkt antworten live mit HTTP 200; das Vercel-Fehlerlog ist leer.
- Der sichtbare Reset-Flow ist durch Komponenten- und Browser-Gates belegt. Ein HTML-Rohabruf wird nicht als Beleg für clientseitig gerenderten Text verwendet.

## Produktionsnachweis - DSGVO-Export-Mandantengrenze (2026-08-11)

- GitHub: PR #59 gemergt, Merge-Commit `ff9d45529e48df9b7acd268432e9ccf4c7c91c64`.
- CI auf `main`: StockPilot CI `31520423798` und Database Tests `31520423808` erfolgreich.
- Supabase-Produktion: Migration `harden_billing_export_tenant_boundary` erfolgreich angewendet.
- Rechteprüfung: RLS aktiv; `anon` ohne SELECT; `authenticated` nur SELECT; keine INSERT-/UPDATE-/DELETE-Rechte; Service-Role-Schreibpfad erhalten.
- Policyprüfung: ausschließlich `Users read own billing events`, gebunden an einen nicht-leeren `auth.uid()` und die eigene `user_id`.
- Vercel-Produktion: Deployment `dpl_3eUzVsgZy6tBpLjz3SAgohqTHDo7` ist READY und bedient `https://stockpilot-ai-beta.vercel.app`.
- Live-Smoke: `/`, `/api/health`, `/account/billing` und `/settings` HTTP 200; anonymer `/api/account/export` HTTP 401.
- Betriebsbeobachtung: FMP lieferte beim Startseiten-Smoke HTTP 429 für mehrere Symbole; der vorhandene Provider-Fallback griff. Das ist ein externer Tarif-/Kapazitätspunkt, kein Fehler dieses Sicherheits-Rollouts.
- BauPro wurde weder geändert noch bereitgestellt.

## Phase 1 - Provider-429-Stabilisierung

- Aktiver Einzelpunkt: die in Produktion beobachtete FMP-429-Anfragewelle im Dashboard beseitigen.
- Quote-Routing priorisiert dedizierte Quote-Provider; FMP bleibt verzögerter Rückfall und Fundamentals-Quelle.
- Chained Batches arbeiten providerweise, nutzen den jeweiligen Cache/Backoff und fragen nur ungelöste Symbole beim nächsten Anbieter an.
- FMP-Quote-Abrufe sind pro Lauf seriell; nach dem ersten 429 wird der gemeinsame Backoff vor weiteren Symbolen geschrieben.
- `Retry-After` bleibt als strukturierte HTTP-Fehlerinformation erhalten.
- Abschlussnachweise folgen erst nach lokalen Gates, GitHub-CI, Produktionsdeployment und Live-Prüfung.

## Phase 1 - Provider-429-Stabilisierung abgeschlossen (2026-08-11)

- PR #61 wurde als `fc790088ad59edf1e5da43245ac015d73146e236` gemergt; PR #62 isoliert den pgTAP-Stack und wurde als `4aafd4ea0a3a4abcd190965a75afe0676fdd8428` gemergt.
- Die zusätzlich live gefundene Sammel-Provenienz wurde in PR #63 korrigiert und als `743497c0cd7810e451e611899f2b80a7254df4e9` gemergt.
- Lokal bestanden: Format, TypeScript, ESLint, 130 Testdateien mit 1.011 Tests und der Produktions-Build mit 35 statischen Seiten.
- Lastnachweis: 2.000 aktive Sitzungen, 2.000 HTTP-200-Antworten, 0 abgewiesene oder fehlgeschlagene HTTP-Anfragen, p95 1.155 ms und 52 gleichzeitig laufende Anfragen.
- Der verpflichtende Stress-Gate bis 500 parallele Anfragen blieb vollständig grün. Die getrennten 1.000-/2.000-Kapazitätsproben hatten jeweils 75 Client-Timeouts und sind als horizontaler Skalierungshinweis dokumentiert, nicht als bestandener Release-Gate.
- Finale Main-Gates: StockPilot CI `31524154601` und Database Tests `31524154520` erfolgreich; 207 pgTAP-Prüfungen laufen ohne Mailpit-Portkonflikt.
- Vercel-Produktion: `dpl_87usaNbURyTjfTNwLaqzsPTmZmjx` ist READY und bedient `https://stockpilot-ai-beta.vercel.app`.
- Live-Smoke: `/`, `/markets`, `/assets/NVDA`, `/api/health` und der Zehn-Symbol-Quote-Batch jeweils HTTP 200.
- Live-Provenienz: Sammelquelle `Finnhub`; alle zehn Quotes `near_realtime`; kein Mock- oder Unavailable-Fallback.
- Produktionslog: genau ein gemeinsames FMP-Backoff-Ereignis im Prüfzeitraum, keine parallele symbolweise 429-Welle.
- BauPro wurde weder geändert noch bereitgestellt.

## Phase 2 - Kanonisches Instrumentenmodell (2026-08-11)

- Phase 1 enthält nach aktuellem Audit keine weitere bestätigte intern lösbare Critical-Lücke; externe Lizenz-, Tarif- und Shared-Infrastrukturpunkte bleiben als Blocker dokumentiert.
- Ein zentraler `CanonicalInstrument`-Typ führt interne ID, Listingidentität, Instrumenttyp, Börsenname/-code, MIC, ISIN, FIGI, Provider-Mappings, Zeitzone, Präzision sowie Aktiv-/Delistingstatus.
- Nicht verifizierte Referenzwerte bleiben `null`. Zu lange oder formal ungültige MIC-, ISIN- und FIGI-Werte werden verworfen; widersprüchliche Aktiv-/Delistingzustände werden weder veröffentlicht noch in PostgreSQL akzeptiert.
- Instrumentkatalog, Instrument Master und Such-API transportieren die kanonischen Felder; bestehende Aliasfelder bleiben kompatibel.
- Die Migration erweitert den persistenten Instrument Master, führt Bestandswerte nur aus bereits belegten Feldern fort und ändert die bestehende serverseitige Upsert-Signatur nicht.
- Lokal bestanden: Format der TypeScript-Dateien, 16 gezielte Tests, TypeScript, ESLint, 131 Testdateien mit 1.015 Tests, Produktions-Build mit 35 Seiten und 35 Browserflüsse; ein Mobile-Duplikatlauf ist bewusst übersprungen.
- Lokaler pgTAP-Start war wegen eines vorherigen ENOSPC-Abbruchs von Docker Desktop nicht möglich. Die 41 Instrument-Master-Assertions und die vollständige Migration müssen daher vor jedem Produktionsschritt im isolierten GitHub-Datenbankworkflow bestehen.
- Produktionsmigration, GitHub-CI, Deployment und Live-Abnahme sind noch ausstehend; dieser Arbeitspunkt ist nicht als abgeschlossen markiert.

## Phase 2 - Produktionsabnahme und Suchranking (2026-08-12)

- PR #65 wurde als `508c30a7d72225dd0cbef12fa8e66fd98b7b14fe` in `main` uebernommen; Anwendung, 224 pgTAP-Pruefungen und Vercel-Vorschau waren erfolgreich.
- Die kanonische Instrumentmigration ist auf dem Produktionsprojekt `STAI` angewendet. RLS, privilegierte Schreibgrenzen und die neuen Constraints wurden direkt gegen Produktion geprueft.
- Das StockPilot-Deployment `dpl_3Y7vph8PPxvP5w4s7SAX2TNaTf8w` ist READY; BauPro wurde nicht veraendert oder deployt.
- Der reale Such-Smoke deckte eine Rankingregression auf: Ein haeufiger bestaetigtes Suffix-Listing konnte den exakten Ticker verdraengen. Der aktive Hotfix priorisiert jetzt exaktes Symbol, exakte Kennung und erst danach Naehe sowie Bestaetigungsdaten.
- Der Suchranking-Hotfix wurde mit PR #66 als `9b49193ba724cb860dbf6f326d75d93fb1f8f8b8` in `main` uebernommen. Exakte Symbole und Kennungen koennen nicht mehr durch Bestaetigungszaehler unscharfer Listings verdraengt werden.
- Lokal bestanden: 5 gezielte Tests, TypeScript, ESLint, 131 Testdateien mit 1.017 Tests, Produktions-Build mit 35 Seiten und 35 Browserfluesse; ein redundanter Desktop-Lauf des Mobile-Tests ist bewusst uebersprungen.
- PR-Gates: StockPilot CI `31553969385`, Database Tests `31553969403` mit 224 pgTAP-Pruefungen und Vercel-Vorschau `dpl_7iLnKN1VK4nDF3VyG9NgNWR2GthA` sind erfolgreich.
- Finale Main-Gates: StockPilot CI `31554156481` und Database Tests `31554156442` sind erfolgreich.
- Produktion: `dpl_3xBgzmgrzzciZd67sFZ6uPyMG4Jt` ist READY und bedient `https://stockpilot-ai-beta.vercel.app`.
- Live-Abnahme: `/`, `/markets`, `/assets/AAPL` und `/api/health` jeweils HTTP 200. Drei aufeinanderfolgende Suchen ordnen `AAPL` auf NASDAQ vor `AAPL.NE`; Abdeckung bleibt ehrlich `complete: false` und `search_driven`; das Fehlerlog ist leer.
- Das kanonische Instrumentenmodell ist damit produktiv abgeschlossen. Naechster einzelner Phase-2-Arbeitspunkt ist das kanonische Quote-Modell. BauPro blieb unveraendert.

## Phase 3 — Provider Registry und Routing abgeschlossen (2026-08-12)

Phase 3 ist mit Produktionsnachweis abgeschlossen. Die zentrale Registry unter
`src/lib/providers/provider-registry.ts` entscheidet jetzt für Quotes,
Krypto, Historie, Instrumentensuche, Fundamentals, News, SEC und Makrodaten
nach Capability, Assetklasse, Konfiguration, Freigabeschalter, Nutzungsrecht
und Health-Status.

Belegte Hauptstände:

- Implementierung: PR #73, Commit `3e76a96`, Merge `3d072ed`.
- Live-Redteam-Fix: PR #74, Commit `868d924`, Merge `cda7624`.
- Lokal: Typecheck, Lint, 139 Testdateien / 1.065 Tests, Build mit 35 Seiten,
  E2E 35 bestanden / 1 bewusst übersprungen.
- PR-CI: `31560753764`, `31560753799`, `31561327284`,
  `31561327285`, alle erfolgreich.
- Main-CI: `31560928157`, `31560928148`, `31561509219`,
  `31561509315`, alle erfolgreich.
- Produktion: `dpl_ERhonfRua42y6NqVrFxpkHdv956z`, Status READY,
  Alias `https://stockpilot-ai-beta.vercel.app`.
- Live: `/`, `/markets`, `/assets/AAPL`, `/api/health` jeweils 200.
- Live fail-closed: Quotes und News 200 mit klarer Unavailable-Provenienz;
  SEC, EZB und FRED 503 mit explizitem Hinweis auf nicht verifizierte externe
  Darstellungsrechte.
- Produktions-Error-Logscan: keine Fehler im Prüfzeitraum.

Externer Blocker bleibt die dokumentierte Prüfung der konkreten
Providerverträge. Ein API-Key allein schaltet keine öffentliche Anzeige frei.

Nächster Arbeitspunkt gemäß Masterplan: **Phase 4 — Caching, Rate Limits und
Circuit Breaker**.

## Phase 5 — FMP-Migration und Hardening abgeschlossen (2026-08-12)

- Sämtliche produktiven FMP-Netzwerkzugriffe laufen über den serverseitigen,
  allowlist-basierten Client `src/lib/providers/fmp-client.ts`.
- Endpunkte, Parameter und Antworten werden validiert; 401, 402/403, 429,
  5xx, Timeout, Circuit Breaker und ungültige Antworten besitzen getrennte,
  secret-freie Fehlercodes.
- Quote, Historie, Fundamentals, Instrumentensuche, Corporate Actions,
  Börsenkalender, Bewertung, News-Ingestion und Provider-Ping nutzen den
  zentralen Adapter. Fehlende Display-Rechte bleiben fail-closed.
- Der FMP-Betriebsvertrag und die gemessenen Tarifgrenzen sind in
  `docs/FMP_ADAPTER.md` dokumentiert. Das Universum bleibt nachweislich
  suchgetrieben und unvollständig; FMP wird nicht als Realtime bezeichnet.
- Live gefundene Qualitätskanten wurden behoben: korrekte Umlaute und
  Zeichensetzung, `unavailable` bleibt bei gecachten Leerantworten erhalten,
  und der DR-Monitor akzeptiert explizit degradierten Betrieb nur ohne
  Mock-Fallback.
- PRs #78, #79, #80 und #81 sind gemergt. Finaler Main-Commit:
  `b03819dd4d3ebd34b5d361ee3e9d4c15fcd94c40`.
- Finale Main-Gates: StockPilot CI `31566452682` und Database Tests
  `31566452673`, beide erfolgreich.
- Lokal bestanden: Enterprise- und Grammatik-Gate, TypeScript, ESLint,
  145 Testdateien mit 1.105 Tests und Produktions-Build mit 35 Seiten.
- Produktion: `dpl_BjDt1QudE7J8an8T85yTeJn8BS3D`, READY,
  `https://stockpilot-ai-beta.vercel.app`; keine Vercel-Error-Logs.
- Live-DR bestanden: Offline/PWA, Security, Eingabegrenzen und explizit
  degradierte Quotes ohne Mock-Fallback. Der externe Upstash/Redis-Hinweis
  bleibt dokumentiert.
- Lastnachweis: 2.000 aktive Sitzungen, 2.000 HTTP-200-Antworten,
  0 Rejections, 0 HTTP-Fehler, p95 484 ms, Maximum 723 ms. Release-Gate bis
  200 gleichzeitige Requests ohne Fehler; 500er-Kapazitätsprobe 500/500 HTTP
  200.
- Ausschließlich `stockpilot-ai` wurde deployt; BauPro blieb unberührt.

Nächster einzelner Arbeitspunkt gemäß Masterplan: **Phase 6 — Twelve Data**.

## Phase 7 – Alpaca-Realtime (2026-08-16)

Status: **IMPLEMENTIERT / AKTIVIERUNG BLOCKED – EXTERNAL**. REST, WebSocket,
Historie, Normalisierung, Resilience, Provenienz und Tests sind integriert.
GitHub-CI, pgTAP und Vercel-Preview für `stockpilot-ai` sind grün.
Produktionsschlüssel und externe Anzeigerechte fehlen; deshalb bleibt der
Provider fail-closed. Nachweis: `docs/PHASE_7_ALPACA_EVIDENCE.md`.


## Phase 8 - Finnhub control/fallback adapter (2026-08-16)

- REST-Authentifizierung auf serverseitigen `X-Finnhub-Token` umgestellt.
- Zod-validierte Clients fuer Quote, Suche, Profil, News, Earnings, Analystentrends, Kursziele, Insider, Wirtschaftskalender und Kerzen ergaenzt.
- WebSocket semantisch korrigiert: Trade-Stream statt unechter Quote-Stream, mit Einzelverbindungs-Lease, Reconnect, Resubscribe, Symbolgrenze und Backpressure-Abbruch.
- News-Fallback und Provider-Health an den zentralen Finnhub-Client angeschlossen.
- Tarifgrenzen gemessen und als `not_entitled` statt als leere oder erfundene Daten modelliert.
- Verifikation: Typecheck und Lint gruen; 156 Testdateien mit 1.161 Tests gruen. Der lokale Produktions-Build wurde wegen reproduzierbar blockierter Workspace-I/O abgebrochen; Turbopack und Webpack lieferten dabei keinen Codefehler. Vercel-Deployment ist auf Nutzerwunsch verschoben.

## Phase 9 - SEC EDGAR (2026-08-17, abgeschlossen)

- Vollständige Ziel-Formularliste inklusive 13F-HR, S-1, 20-F und 6-K ergänzt.
- Historische SEC-Submission-Segmente, Metadaten, direkte CIK-Auflösung, Deduplizierung und Neu-Erkennung implementiert.
- SEC-Abrufe teilen ein konservatives Fair-Access-Limit; nur offizielle SEC-Hosts bleiben erlaubt.
- API validiert Formularfilter und Limit und liefert Provider-, Qualitäts- und Zeitstatus.
- Syntaxcheck und ein direkter SEC-Modultest mit 19 Funktions- und Sicherheitsprüfungen sind grün. GitHub-CI ist vollständig grün: TypeScript, ESLint, Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke, Performance-/Enterprise-Gates sowie Supabase-Migrationen, RLS und Integrität. Draft-PR: `#87`.

## Phase 10 - FRED (2026-08-17, abgeschlossen)

- US-Katalog von 13 auf 23 Reihen erweitert: PCE/Kern-PCE, Treasury 2/5/30 Jahre, M2, Industrieproduktion und drei Liquiditätsreihen.
- Server-only JSON-Client nutzt mit `FRED_API_KEY` Erstveröffentlichungen und Revisionsvergleich; ohne Schlüssel bleibt der offizielle CSV-Fallback aktiv und kennzeichnet fehlende Vintage-Daten.
- Beobachtungsdatum, Erstveröffentlichung, Vintage-Stand und Revision werden getrennt modelliert und angezeigt.
- API- und CSV-Abrufe laufen in begrenzten Batches durch zentrale SSRF-, Timeout-, Größen-, Cache- und Rate-Limit-Schutzschichten.
- Syntaxcheck für 11 Dateien, direkter FRED-Modultest mit 19 Prüfungen und Diff-Hygiene sind grün. GitHub-CI ist vollständig grün: TypeScript, ESLint, Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke, Performance-/Enterprise-Gates sowie Supabase-Migrationen, RLS und Integrität. Draft-PR: `#88`.

## Phase 12 - CoinGecko-Referenzdaten (2026-08-17, abgeschlossen)

- Serverseitiger Referenzadapter für Coin-ID, Handelspaare, Kategorien, Blockchain-Adressen, Market Cap, Volumen, Supply, Börsen und globale Kryptomarktbreite.
- Mehrdeutige Symbole werden mit 409 abgewiesen statt nach Rang geraten; fehlende Providerfelder bleiben leer.
- Binance und Coinbase bleiben schnelle Kursquellen. CoinGecko wird ausschließlich als `DELAYED` oder `CACHED`, nie als sekündlicher Live-Feed angezeigt.
- Profi-Kryptoansicht um Identität, Rang, Kategorien, Adressen, Total Supply, Börsenabdeckung und deterministisch berechnete Dominanz erweitert.
- Optionaler API-Key bleibt in allowgelisteten Server-Headern. Produktion bleibt bis zur Rechteprüfung fail-closed.
- Betriebsvertrag: `docs/COINGECKO_ADAPTER.md`.
- GitHub-CI `31981310385` vollständig grün: TypeScript, ESLint, 159 Testdateien / 1.195 Tests, Produktions-Build, Browser-Smoke, Performance, Enterprise-, Sprach-, Dependency-, Lizenz- und institutionelle Gates. pgTAP `31981310384` inklusive Migrationen, RLS und Integrität grün. Draft-PR: `#90`.
- Vercel-Preview ausschließlich wegen `api-deployments-free-per-day` blockiert; weder StockPilot-Production noch BauPro wurden verändert.

## Phase 13 - Coinbase Streaming (2026-08-17, implementiert)

- Oeffentlicher Advanced-Trade-WebSocket fuer Kryptokurse serverseitig integriert.
- Ein geteilter Hub verteilt eine Upstream-Verbindung an viele SSE-Nutzer und begrenzt die aktive Produktmenge.
- Ticker, Bid/Ask, Mengen, 24h-Spanne, 52-Wochen-Spanne, Volumen, Providerzeit und gemessene Latenz werden ohne Ersatzwerte normalisiert.
- Reconnect, Heartbeat-Watchdog, Sequenzluecken-Erkennung, Client-isolierter Rueckstau-Schutz und REST-Fallback sind eingebaut.
- `*-USDC`-Identitaeten werden nicht still auf `*-USD` umgedeutet.
- Betriebsvertrag und Aktivierung: `docs/COINBASE_STREAMING.md`.

## Phase 14 - Binance Streaming (2026-08-17, implementiert)

- Geteilter offizieller Market-Data-WebSocket fuer Ticker, Best Bid/Ask, Trades und laufende Kerzen.
- Eine kombinierte Verbindung je Serverprozess ersetzt eine Providerverbindung pro Nutzer.
- Binance-Venue, `BTCUSDT`-Provideridentitaet und USDT-Waehrung bleiben getrennt von Coinbase sichtbar.
- Reconnect, 24-Stunden-Rotation, Inaktivitaets-Watchdog, Trade-Sequenzpruefung, Book-Update-Pruefung und Client-isolierter Rueckstau-Schutz sind integriert.
- Voll-Orderbuch und Snapshot-Recovery werden nicht behauptet; Bid/Ask stammt transparent aus `bookTicker`.
- Betriebsvertrag: `docs/BINANCE_STREAMING.md`.

## Phase 15 - Cross-Provider Data Quality (2026-08-17, implementiert)

- Bis zu vier Providerbeobachtungen werden deterministisch kontrolliert; Standard sind zwei.
- Primaerkurse werden nie gemittelt oder durch einen synthetischen Konsens ersetzt.
- Symbol, Assetklasse, Handelswaehrung, Marktphase und Zeitstand muessen vor einem Preisvergleich zusammenpassen.
- Bestaetigung, Divergenz, Nichtvergleichbarkeit, Zeitversatz und Einzelquelle sind getrennte Qualitaetszustaende.
- Materielle Divergenz setzt `DIVERGENT`, begrenzt den Score auf 25 und sperrt aktuelle Analysen.
- Coinbase USD und Binance USDT bleiben auch bei gleichem App-Symbol getrennte Beobachtungen.
- Betriebsvertrag: `docs/CROSS_PROVIDER_DATA_QUALITY.md`.

## Phase 11 - ECB SDMX (2026-08-17, abgeschlossen)

- Offizielle Reihen für Bankkredite an nichtfinanzielle Unternehmen und tägliche Überschussliquidität ergänzt und direkt gegen das ECB Data Portal verifiziert.
- SDMX-Abrufe nutzen `detail=full` und `includeHistory=true`; `VALID_FROM`/`VALID_TO` trennen Beobachtung, Erstveröffentlichung, aktuellen Vintage und Revision.
- Das providerübergreifende Lebenszyklusmodell speichert Serienkennung, Frequenz, Einheit, Region, Provider, Beobachtungszeit, Veröffentlichungszeit und Revisionsstatus.
- Jede Makrokarte zeigt ihre konkrete Primärquelle und Serienkennung; ECB-Zeitstempel werden lesbar formatiert.
- Syntaxcheck für 12 Dateien, direkter ECB-Modultest mit 9 Prüfungen und Diff-Hygiene sind grün. Nach Korrektur eines veralteten URL-Vertragstests ist GitHub-CI vollständig grün: TypeScript, ESLint, 1.177 Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke, Performance-/Enterprise-Gates, Sprachprüfung, Dependency-/Lizenzprüfung und institutionelle Kontrollen. Supabase-RLS/Integrität war im ersten Lauf desselben PR grün. Draft-PR: `#89`.

## Phase 16 - Sichtbare anbieteruebergreifende Kurspruefung (2026-08-17)

- Zentrale UI-Zustaende fuer bestaetigte, divergierende, nicht vergleichbare, veraltete und nur aus einer Quelle stammende Kurse.
- Keine Mittelung: Der Primaerkurs bleibt unveraendert; Divergenz wird als Analyseblocker erklaert.
- Integration in Marktband, Dashboard-Listen, Watchlist und Asset-Detailseite.
- Zugängliche Labels, Tooltips und Komponententests dokumentieren die erlaubten Aussagen.
- Details: `docs/DATA_TRUST_UI.md`.

## Phase 17 - Provider-Health Security (2026-08-17)

- Allgemeine Provider-Pings auf den zentralen begrenzten HTTP-/Resilience-Layer umgestellt.
- HTTPS-Allowlist, Antwortgroesse, Timeout, Circuit-Breaker und Rate-Limit-Cooldown gelten nun auch fuer Health-Checks.
- NewsAPI-Key aus der URL in einen explizit erlaubten serverseitigen Header verschoben.
- Sichere Fehlerklassifizierung fuer Erfolg, 429 und ungueltige Antworten ergaenzt.
- Details: `docs/PROVIDER_HEALTH_SECURITY.md`.

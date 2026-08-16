# StockPilot AI Execution Ledger

Stand: 2026-08-12

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
| --- | --- |
| Phase | Phase 6: Twelve Data abgeschlossen |
| Abgeschlossener Punkt | Twelve-Data-Adapter, Normalisierung, Routing, Suche, Batch, Historie, Status und Streaming-Lifecycle lokal, in CI und Produktion belegt |
| Nächster Punkt | Phase 7: Alpaca Realtime |
| Produktionsstand | Phase-6-Laufzeitcommit `425c4163f2565a565c39db48420ac89df6940bf1`; Deployment `dpl_GknMoY35ArrDnps6Ri2HTCrs3iVa` READY |
| Repository | `homann09-hue/STAI` |
| Produktion | `https://stockpilot-ai-beta.vercel.app` |
| Vercel-Projekt | ausschließlich `stockpilot-ai`; BauPro blieb unberührt |

## Abgeschlossener Arbeitspunkt

- `NormalizedBar` umfasst Instrument-/Provideridentität, Provider-Symbol, Venue, Chartbereich, Intervall, UTC-Open/Close, OHLCV, Trade Count, VWAP, Währung, Empfangs-/Providerzeit, Qualität und Provenienz.
- Roh-, splitbereinigte, dividendenbereinigte und kombiniert bereinigte OHLC-Reihen sind getrennte, validierte Zustände. Ein separater Adjusted Close ändert nicht still die OHLC-Semantik.
- Fehlende oder widersprüchliche OHLCV-Zeilen, negative Volumina, falsche Intervalle, Zukunftszeiten, Duplikate, divergente Duplikate und gemischte Adjustment-Arten werden abgewiesen oder sperren die Analyse.
- FMP-Historien werden zentral normalisiert. Unbekannte Währung/Instrument-ID bleibt `XXX`/`null`; es wird nichts geraten.
- Charting repariert keine Providerdaten mehr. Das Marktband erzeugt bei fehlender Historie keine synthetische Sparkline.
- Technical, Risk, Scores, probabilistische Analyse und Backtest verlangen dasselbe Bar-Qualitätsgate.
- Live-Red-Team fand auf dem ersten Deployment einen Altpfad, der partielle Bars trotzdem als verifiziert bezeichnete. PR #71 schloss den Pfad; ein Regressionstest erzwingt den fail-closed Zustand.

## Belegte Prüfungen

| Gate | Ergebnis |
| --- | --- |
| TypeScript | bestanden |
| ESLint | bestanden, 0 Warnungen |
| Unit/Integration | 137 Dateien, 1.052 Tests bestanden |
| Produktionsbuild | bestanden, 35 Seiten |
| Browser/E2E | 35 bestanden, 1 redundanter Desktop-Mobile-Lauf bewusst übersprungen |
| Implementierungs-PR | #70, Commit `a73504a`, Merge `26287b1` |
| Live-Gate-Fix-PR | #71, Commit `b78f97c`, Merge `02c245c` |
| PR #71 App-CI | `31558783700`, erfolgreich |
| PR #71 Datenbanktests | `31558783669`, erfolgreich |
| Main App-CI | `31558970326`, erfolgreich |
| Main Datenbanktests | `31558970332`, erfolgreich |

## Produktionsnachweis

| Beleg | Ergebnis |
| --- | --- |
| Deployment | `dpl_G2F3HnTSWX7rGD2YpyjorN3xyFFp`, READY, target production |
| Live-Alias | `https://stockpilot-ai-beta.vercel.app` |
| Kernseiten | `/`, `/markets`, `/assets/AAPL`, `/api/health`: HTTP 200 |
| Fail-closed Asset-API | AAPL: 403 `quote_not_entitled`; Identität bleibt ohne Kurs-/Analyseerfindung erhalten |
| Kontrollsymbole | SPY/MSFT/NVDA: 503 `identity_unverified` statt plausibler Ersatzdaten |
| Instrumentuniversum | `coverage.complete=false`; aktuell kein als `available` bestätigtes FMP-Symbol im gespeicherten Universum |
| Produktionslogs | nur erwartete `info`-Requests, keine Runtime-Fehler im Prüfzeitraum |
| Projektgrenze | nur `stockpilot-ai`; BauPro nicht verändert oder deployt |

## Externer Blocker

`BLOCKED – EXTERNAL`: Ein finaler Live-Inhaltstest der neuen Providerbars benötigt mindestens ein Instrument, für das der aktive Produktionsprovider gleichzeitig eine verifizierte Identität, Quote und Historie freigibt. Der FMP-Tarif sperrt AAPL aktuell symbolweise; SPY, MSFT und NVDA sind im Instrument Master derzeit nicht verifiziert. Der Code-, Contract-, Integrations-, E2E-, CI-, Deployment- und fail-closed Nachweis ist vollständig; echte Providerbar-Inhalte können erst nach Tariffreigabe oder Phase-3-Routing zu einem berechtigten Provider erneut live belegt werden.

## Nächster zulässiger Schritt

Phase 7 beginnt mit der Bestandsaufnahme der bestehenden Alpaca-Pfade und der
IEX-Feedgrenzen. Quotes, Trades, Historie, WebSocket, Reconnect,
Resubscribe, Limits und Market Session werden erst nach demselben vollständigen
Freigabeprozess als abgeschlossen markiert. BauPro bleibt außerhalb jeder
Aktion.

## 2026-08-12 — Phase 6: Twelve Data, lokale Freigabe

**Implementiert:**

- Zentraler serverseitiger Twelve-Data-Client mit fester HTTPS-/WebSocket-
  Zielbindung, Header-Authentifizierung für REST, Antwortvalidierung und
  standardisierten, secret-freien Fehlern.
- Normalisierung für Quotes, echte Batch-Antworten, Symbolsuche,
  Listingauflösung, Marktstatus und historische OHLCV-Bars; Provideridentität,
  MIC, Land, Zeitzone, Qualität und Zeitstempel bleiben erhalten.
- Provider-Routing und Instrumentkatalog nutzen Twelve Data ohne eine zweite
  Parallelarchitektur. Historie fällt nur kontrolliert auf einen berechtigten
  Provider zurück.
- Batch-, Cache-, Coalescing-, Rate-Limit-, Retry- und Circuit-Regeln sind in
  die bestehende gemeinsame Resilience-Laufzeit integriert.
- WebSocket-Streaming ist tariflich standardmäßig aus. Bei Aktivierung sind
  Subscribe, Heartbeat, begrenzte Queue, Reconnect, Resubscribe und
  Abort-/Listener-Cleanup getestet; REST-Polling bleibt verfügbar.
- Health und geschützte Providerdiagnose unterscheiden fehlenden Schlüssel,
  fehlende Rechte, deaktivierten Stream, Tarifgrenze und Providerfehler.

**Lokale Evidenz:**

- Format, TypeScript und ESLint: erfolgreich.
- Unit/Integration: 149 Dateien, 1.129 Tests, alle erfolgreich.
- Coverage: Statements 46,83 %, Branches 44,98 %, Functions 46,64 %,
  Lines 48,57 %; Twelve-Client 80,11 % Statements.
- Produktionsbuild: erfolgreich, 35 Seiten.
- Browser/E2E: 35 erfolgreich, 1 redundanter Desktop-Mobile-Lauf bewusst
  übersprungen.
- Dependency-Audit: 0 bekannte Schwachstellen; Lizenzprüfung erfolgreich mit
  den dokumentierten transitiven Sharp/libvips-LGPL-Prüfhinweisen.
- Performance-Budget: 1.755.087 Bytes / 1.714 KiB, unter 2 MiB.
- Enterprise-Readiness 99/100; einzige Warnung ist der absichtlich erst nach
  Deployment ausführbare Live-URL-Test. Institutional-Readiness 28/28.
- 2.000 aktive Sitzungen: 2.000 HTTP-200-Antworten, 0 Rejections,
  0 HTTP-Fehler, `p95` 360 ms, Maximum 477 ms.
- Stress-Release-Gate bis 500 gleichzeitig: 0 Rejections, 0 HTTP-Fehler,
  `p95` 3.511 ms. Die nicht-gatenden 1.000-/2.000-Proben hatten jeweils
  74 Client-Timeouts und belegen die Einzelprozessgrenze.
- Chaos: fehlender Schlüssel, Provider-Deadline, deaktivierter Kryptopfad,
  Eingabegrenzen und Rate-Limit-Burst ohne unerwartete Fehler.
- Offizieller Twelve-Demo-Smoke: AAPL-Suche löst NASDAQ/XNGS zuerst auf;
  Quote und 5.000 historische Tagesbars werden normalisiert. Der Demo-Key ist
  kein Produktionsschlüssel und kein Nachweis externer Display-Rechte.

**GitHub- und Produktionsnachweis:**

- Implementierungscommit `f27d893`; CI-Isolationsfix `b73b980`.
- Der erste PR-CI-Lauf deckte auf, dass die globale Mock-Konfiguration den
  Twelve-Integrationstest übersteuerte. Der Test setzt seinen Provider nun
  explizit; derselbe Coverage-Lauf bestand anschließend vollständig.
- PR #83 wurde als `425c4163f2565a565c39db48420ac89df6940bf1`
  in `main` übernommen.
- PR-CI `31569663725`, PR-Datenbanktests `31569663644`, Main-CI
  `31569858919` und Main-Datenbanktests `31569858893`: erfolgreich.
- Deployment `dpl_GknMoY35ArrDnps6Ri2HTCrs3iVa`, READY, Alias
  `https://stockpilot-ai-beta.vercel.app`.
- Live: Dashboard, Märkte, AAPL, Offline, Manifest und Health HTTP 200.
  Suche und Quotes bleiben ohne verifizierten externen Provider ehrlich leer;
  Provider-Pings sind öffentlich quota-schonend geschützt.
- Live-DR und Enterprise-Readiness bestanden. Der öffentliche Health-Endpunkt
  legt den Shared-Cache-Status absichtlich nicht offen; Vercel führt KV/Redis-
  Variablen, die tatsächliche geteilte Laufzeitnutzung bleibt ohne
  autorisierte Diagnose unbestätigt.
- 2.000 aktive Produktionssitzungen: 2.000 HTTP 200, 0 Rejections,
  0 HTTP-Fehler, `p95` 485 ms, Maximum 1.011 ms. Die 500er-Spitzenprobe
  lieferte 500/500 HTTP 200; 14 Antworten lagen über fünf Sekunden.
- Vercel-Logscan nach Smoke und Last: keine Error-, HTTP-500- oder
  Warning-Ereignisse.
- `BLOCKED – EXTERNAL`: eigener Twelve-Schlüssel, Tarif und externe
  Display-/Redistributionsrechte fehlen; der Feed bleibt produktiv aus.
- Ausschließlich `stockpilot-ai` wurde bereitgestellt; BauPro blieb unberührt.

**Ergebnis:** Phase 6 vollständig abgeschlossen. Nächster einzelner Punkt ist
Phase 7: Alpaca Realtime.

## 2026-08-12 — Phase 3: Provider Registry und Routing

**Ziel:** Eine einzige, typisierte und provider-unabhängige Entscheidung für
externe Datenzugriffe mit ehrlicher Lizenz-, Capability- und
Failover-Behandlung.

**Implementiert:**

- Registry für Alpaca, Twelve Data, Finnhub, FMP, Alpha Vantage,
  Massive/Polygon, EODHD, Databento, Binance, Coinbase, Marketaux, NewsAPI,
  SEC EDGAR, FRED, EZB und CoinGecko.
- Maschinenlesbare Lizenzpolicy mit Umgebung, interner/externer Nutzung,
  Redistribution, Derived Data, Attribution, Verzögerung, Feed-Typ und
  Verifikationszeitpunkt.
- Routing nach Capability, Assetklasse, Markt, bevorzugtem Provider,
  Konfiguration, Enable-Flag, Lizenz und Health.
- Gesunde Provider vor degradierten; unavailable/open-circuit ausgeschlossen.
- Migration von Quote-Kette, Krypto-Auswahl, Historie, Instrumentensuche,
  Fundamentals, News, SEC und Makrodaten.
- Secret-freier Registry-Snapshot im geschützten Health-Endpunkt.
- Fehlende Providerwährung bleibt `XXX` statt erfundenem `USD`.
- Live-Redteam-Regressionsschutz für SEC- und Makro-Rechtesperren.

**Lokale Evidenz:**

- `npm run typecheck`: erfolgreich.
- `npm run lint`: erfolgreich.
- `npm test`: 139 Dateien, 1.065 Tests, alle erfolgreich.
- `npm run build`: erfolgreich, 35 Seiten.
- `npm run test:e2e`: 35 erfolgreich, 1 bewusst übersprungen.
- `git diff --check`: erfolgreich.
- Secret-Musterscan im Diff: kein Treffer.

**GitHub-/Datenbank-Evidenz:**

- PR #73: https://github.com/homann09-hue/STAI/pull/73
- PR #74: https://github.com/homann09-hue/STAI/pull/74
- Implementierungs-Merge: `3d072ed477fec4d57b196460947625cedd59d00d`.
- Finaler Fix-Merge: `cda7624f0923b2bc920a72f46338b79f42643a14`.
- PR CI/DB: `31560753764`, `31560753799`, `31561327284`,
  `31561327285` — erfolgreich.
- Main CI/DB: `31560928157`, `31560928148`, `31561509219`,
  `31561509315` — erfolgreich.

**Produktions-Evidenz:**

- Deployment: `dpl_ERhonfRua42y6NqVrFxpkHdv956z`, READY.
- Alias: `https://stockpilot-ai-beta.vercel.app`.
- HTML/API-Smoke: Dashboard, Märkte, AAPL-Detail und Health 200.
- Quotes: 200, keine Quotes, Provider „Kein verifizierter
  Marktdatenanbieter“.
- News: 200, leer, Qualität `unavailable`.
- SEC: 503, externe Anzeige für SEC EDGAR nicht verifiziert.
- EZB: 503, externe Anzeige für EZB nicht verifiziert.
- FRED: 503, externe Anzeige für FRED nicht verifiziert.
- Vercel Error-Logs: keine Fehler im Prüfzeitraum.
- BauPro: nicht geändert und nicht deployt.

**Ergebnis:** Phase 3 abgeschlossen. Nächster Punkt ist Phase 4: Caching, Rate
Limits und Circuit Breaker.

## 2026-08-12 — Phase 4: Caching, Rate Limits und Circuit Breaker

**Implementiert:**

- Typisierte Cache-Policies für Quote, Asset, Dashboard, Fundamentals, News,
  Makro, Filings, historische Bars, Instrumentmetadaten, Analysen, Forecasts
  und Professional-Daten.
- Providerbezogene Request-Budgets, Burst-Limits, Parallelitätsgrenzen,
  Warteschlangen, Retry-Klassifikation, exponentieller Backoff mit Jitter und
  `Retry-After`-Cooldown.
- Circuit Breaker mit geteiltem Zustand, Fast-Fail, exakt einem Half-open-Probe
  und vollständiger Provider-Isolation.
- Request-Coalescing und Deduplizierung über gehashte Request-Identitäten;
  URLs, Queryparameter und API-Schlüssel erscheinen nicht in Metriken oder
  Logs.
- Atomare Cache-Zähler, `SET NX`-Sperren, besitzersicheres Freigeben,
  2,5-Sekunden-Upstash-Deadline und maximal 30 Tage Cachezeit.
- Geschützte Betriebsdiagnose mit aggregierten Metriken und Circuit-Zuständen.

**Prüf- und Lastnachweis:**

- Typecheck und ESLint erfolgreich.
- 142 Testdateien / 1.082 Tests erfolgreich.
- Produktionsbuild erfolgreich, 35 statische Seiten.
- Browser/E2E: 35 erfolgreich, 1 redundanter Lauf bewusst übersprungen.
- 2.000 aktive Sitzungen: 2.000 Antworten, 0 Rejections, 0 HTTP-Fehler,
  `p95` 367 ms, Maximum 444 ms.
- Stress-Gate bis 500 gleichzeitige Anfragen: 0 Rejections, 0 HTTP-Fehler.
- 1.000/2.000 gleichzeitige Einzelprozess-Proben blieben bewusst
  nicht-blockierende Kapazitätsmessungen; horizontale Skalierung benötigt den
  externen Shared Cache.
- Chaos-Szenarien für fehlende Schlüssel, Provider-Deadline, deaktivierten
  Kryptoprovider und Rate-Limit-Burst erfolgreich.
- Format- und Dependency-Audit erfolgreich; 0 bekannte Schwachstellen.

**GitHub und Produktion:**

- PR #76: https://github.com/homann09-hue/STAI/pull/76
- Implementierungscommit `11cd4fd`; Merge/Main
  `a9de16bfe9a633283b8199764dca702939e13874`.
- PR CI/DB: `31563071386`, `31563071330` — erfolgreich.
- Main CI/DB: `31563261983`, `31563262143` — erfolgreich.
- Deployment `dpl_BNgRtaHEupghcb6XgXX2PjiNm7fj`, READY, target production.
- Alias `https://stockpilot-ai-beta.vercel.app`.
- `/`, `/markets`, `/assets/AAPL`, `/api/health`, Quotes und News: HTTP 200.
- Fehlende Providerrechte bleiben leer/`unavailable`; keine Ersatzdaten.
- Vercel Error-Logs: keine Fehler im Prüfzeitraum.
- Ausschließlich `stockpilot-ai` wurde deployt; BauPro blieb unberührt.

**Ergebnis:** Phase 4 abgeschlossen. Nächster einzelner Punkt ist Phase 5:
FMP-Adapter härten.

## 2026-08-12 — Phase 5: FMP-Migration und Hardening

**Implementiert:**

- Zentraler serverseitiger FMP-Client mit HTTPS-/Hostbindung, geschlossener
  Endpunkt- und Parameter-Allowlist, Zod-Validierung und Secret-Isolation.
- Standardisierte Fehler für Konfiguration, Eingabe, Authentifizierung,
  Entitlement, Rate Limit, Verfügbarkeit und Schemafehler.
- Migration aller FMP-Pfade: Quotes, Historie, Übersichts- und
  Mehrjahres-Fundamentals, Instrumentensuche, Corporate Actions,
  Börsenkalender, Bewertung/Peers/Analysten, Intelligence-News und Health.
- Provider-Registry um Corporate Actions und Markt-Kalender erweitert;
  Bewertungsdaten prüfen Display-Rechte selbst und enden ohne Freigabe
  fail-closed.
- Cachequalität trennt gecachte Verfügbarkeit von gecachten Leerantworten:
  fehlende Fundamentals bleiben `unavailable` und tragen den Cachezustand
  separat.
- DR- und Lastverträge unterscheiden echte Infrastrukturfehler von explizit
  deklariertem, mock-freiem Degraded-Betrieb.
- Verbindlicher Adaptervertrag: `docs/FMP_ADAPTER.md`.

**Prüfnachweis:**

- Enterprise-Readiness, Grammatik, TypeScript, ESLint und Build erfolgreich.
- 145 Testdateien / 1.105 Tests erfolgreich.
- Live-DR erfolgreich; einzige Warnung ist die extern fehlende
  Upstash/Redis-Konfiguration.
- 2.000 aktive Sitzungen: 2.000 HTTP 200, 0 Rejections, 0 HTTP-Fehler,
  p50 50 ms, p95 484 ms, Maximum 723 ms, 67 Requests/s.
- Microburst-Release-Gate bis 200 gleichzeitig: 0 Rejections, 0 HTTP-Fehler,
  p95 1.739 ms. Nicht-gatende 500er-Probe: 500 HTTP 200, p95 4.750 ms.

**GitHub-/Datenbank-Evidenz:**

- PR #78: https://github.com/homann09-hue/STAI/pull/78
- PR #79: https://github.com/homann09-hue/STAI/pull/79
- PR #80: https://github.com/homann09-hue/STAI/pull/80
- PR #81: https://github.com/homann09-hue/STAI/pull/81
- Finaler Main-Commit: `b03819dd4d3ebd34b5d361ee3e9d4c15fcd94c40`.
- Finale Main-CI: `31566452682`, erfolgreich.
- Finale Main-Datenbanktests: `31566452673`, erfolgreich.

**Produktions-Evidenz:**

- Deployment: `dpl_BjDt1QudE7J8an8T85yTeJn8BS3D`, READY.
- Alias: `https://stockpilot-ai-beta.vercel.app`.
- Dashboard, Märkte, AAPL-Detail, Health, Suche, Quotes, Fundamentals,
  Corporate Actions, Kalender und News geprüft.
- FMP-Suche liefert den persistenten Instrument Master; Abdeckung bleibt
  `complete: false` und `search_driven`.
- Quotes, Fundamentals, Corporate Actions, Kalender und News zeigen ohne
  verifizierte externe Rechte `unavailable`; keine Ersatzwerte oder
  Mock-Daten.
- Fundamentals-Leerantwort: HTTP 404, Qualität `unavailable`, Cachezustand
  separat sichtbar.
- Produktions-Error-Logs: keine Fehler im Prüfzeitraum.
- Ausschließlich `stockpilot-ai` wurde bereitgestellt; BauPro blieb
  unverändert.

**Ergebnis:** Phase 5 abgeschlossen. Nächster einzelner Punkt ist Phase 6:
Twelve Data.

## Phase 7 Alpaca implementation evidence – 2026-08-16

- Technische Implementierung und lokale/CI-Abnahme bestanden.
- Commit `f891187`, PR `#85`.
- CI `31969442452` und Datenbank-CI `31969442515` bestanden.
- Preview ausschließlich für Vercel-Projekt `stockpilot-ai` bestanden.
- Externer Blocker: keine Produktionsschlüssel und keine bestätigten externen
  Anzeigerechte.
- Nächste Aktion: Vertrag aktivieren, Secrets setzen und echten Feed-Smoke
  durchführen.
- Evidenz: `docs/PHASE_7_ALPACA_EVIDENCE.md`.

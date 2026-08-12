# StockPilot AI Execution Ledger

Stand: 2026-08-12

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
| --- | --- |
| Phase | Phase 2: kanonische Instrument-/Quote-/Bar-Modelle abgeschlossen |
| Abgeschlossener Punkt | Kanonisches Bar-/Kerzenmodell einschließlich Analyse-Gate |
| Nächster Punkt | Phase 3: Provider Registry und Routing |
| Produktionsstand | `main` auf `02c245cfc92cf475dc865873a37d12f7895279c0` |
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

Phase 3 beginnt mit der Bestandsaufnahme und Vereinheitlichung der Provider Registry und der Routing-Matrix. Das erste Ziel ist eine zentrale, konfigurierbare Auswahl nach Capability, Assetklasse, Lizenz, Health und Datenqualität, ohne Providerpriorität im Frontend und ohne einen gesperrten FMP-Quote als stillen Mock-/Fallbackpfad zu ersetzen.

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

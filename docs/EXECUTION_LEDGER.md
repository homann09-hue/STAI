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

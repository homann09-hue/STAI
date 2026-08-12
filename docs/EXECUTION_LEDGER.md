# StockPilot AI Execution Ledger

Stand: 2026-08-12

## Aktueller Arbeitszustand

| Feld                  | Tatsächlicher Stand                                    |
| --------------------- | ------------------------------------------------------ |
| Phase                 | Phase 2: kanonische Instrument-/Quote-/Bar-Modelle     |
| Abgeschlossener Punkt | Kanonisches Quote-Modell                               |
| Nächster Punkt        | Kanonisches Bar-/Kerzenmodell                          |
| Produktionsstand      | `main` auf `75ac1052839f4a8bb60625421c07c825db4843b6`  |
| Dokumentationsbranch  | `codex/phase-2-quote-evidence`                         |
| Repository            | `homann09-hue/STAI`                                    |
| Produktion            | `https://stockpilot-ai-beta.vercel.app`                |
| Vercel-Projekt        | ausschließlich `stockpilot-ai`; BauPro blieb unberührt |

## Abgeschlossener Arbeitspunkt

- `NormalizedQuote` bildet Instrument-ID, Provider-ID, Provider-Symbol, Venue, Währung, Bid/Ask/Last und Größen, OHLC, Previous Close, Change, Volumen, VWAP, Marktphase, Event-/Provider-/Empfangszeit, Realtime-Nachweis, Verzögerung, Feedtyp und Qualitätszustand ab.
- `buildNormalizedQuote()` ist die zentrale Domain-Grenze. REST, Stream, Provider, professionelle Datenansicht und Legacy-UI-Adapter nutzen denselben Vertrag.
- Nullkurse werden nicht als `0` publiziert. Gekreuzte Märkte, negative Volumina und zukünftige Zeitstempel werden als `INVALID` behandelt.
- Unbekannte Währung bleibt `XXX`; unbekannte Instrument-ID oder Venue bleibt `null`. Es werden keine plausibel wirkenden Werte ergänzt.
- `isRealtime` setzt Realtime-Qualität, `REALTIME`-Feed, gemeldete Null-Verzögerung, Event-Zeit und einen nicht ungültigen/nicht stale Zustand voraus.
- Qualitätszustände bleiben über API-Roundtrips monoton: `INVALID`, `STALE`, `DIVERGENT`, `PROVIDER_DEGRADED` und `UNAVAILABLE` werden nicht versehentlich hochgestuft.
- Das Analyse-Gate sperrt unzureichende, stale, divergente, degradierte, ungültige oder nicht verfügbare Quotes.

## Belegte Prüfungen

| Gate                | Ergebnis                                                        |
| ------------------- | --------------------------------------------------------------- |
| TypeScript          | bestanden                                                       |
| ESLint              | bestanden, 0 Warnungen                                          |
| Unit/Integration    | 132 Dateien, 1.025 Tests bestanden                              |
| Produktionsbuild    | bestanden, 35 Seiten                                            |
| Browser/E2E         | 35 bestanden, 1 redundanter Lauf bewusst übersprungen           |
| Pull Request        | #68, Implementierung `f4f4717959cb5cdc7ee6934a60897be51df0f10c` |
| Merge               | `75ac1052839f4a8bb60625421c07c825db4843b6`                      |
| PR-CI               | `31555878371`, erfolgreich                                      |
| PR-Datenbanktests   | `31555878466`, erfolgreich                                      |
| Main-CI             | `31556173755`, erfolgreich                                      |
| Main-Datenbanktests | `31556173724`, erfolgreich                                      |

## Produktionsnachweis

| Beleg                | Ergebnis                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Datenbankmigration   | keine erforderlich                                                                        |
| Deployment           | `dpl_CNqvdkS78XHgo7MyVVKe3gBkVNSp`, READY                                                 |
| Live-Alias           | `https://stockpilot-ai-beta.vercel.app`                                                   |
| Kernseiten           | `/`, `/markets`, `/assets/AAPL`, `/api/health`: HTTP 200                                  |
| Aktienquote          | AAPL, MSFT, NVDA über FMP: `DELAYED`, `isRealtime: false`                                 |
| Kryptoquote          | BTC-USD über Binance: `NEAR_REALTIME/PARTIAL`, `isRealtime: false`                        |
| Quote-Vertrag        | vier Produktionsquotes mit Provider-, Venue-, Feed-, Zeit- und Qualitätsfeldern validiert |
| Produktionsfehlerlog | keine Fehler im Prüfzeitraum                                                              |
| Projektgrenze        | nur `stockpilot-ai`; BauPro nicht verändert oder deployt                                  |

## Offene fachliche Punkte und externe Blocker

- Quote-Instrument-IDs bleiben bei symbolbasierten Providerabrufen `null`, bis der Quote-Service die kanonische Instrumentauflösung direkt übernimmt; die Datenqualität markiert dies als `PARTIAL`.
- FMP liefert im aktiven Tarif kein vollständiges Instrumentverzeichnis und sperrt Quotes symbolweise.
- Vollständige Realtime- und Display-Rechte benötigen geeignete Provider- und Börsenverträge.
- Verteilter Cache und globales Rate Limiting benötigen eine konfigurierte Redis-/Upstash-Instanz.
- Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang und Signierung.
- Kommerzieller Betrieb benötigt rechtlich geprüfte Texte und bestätigte Datenlizenzen.

## Nächster zulässiger Schritt

Das kanonische Bar-/Kerzenmodell wird als nächster einzelner Phase-2-Arbeitspunkt auditiert und umgesetzt. Es muss Instrument und Provider, Intervall, Open/Close-Zeit, OHLC, Volumen, Trade Count, VWAP, Währung sowie Roh-/Split-/Dividendenanpassung eindeutig und providerunabhängig abbilden. Erst nach vollständigen lokalen Gates, GitHub-CI, StockPilot-Deployment und Live-Nachweis beginnt der nächste Punkt.

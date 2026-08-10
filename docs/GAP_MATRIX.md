# Gap-Matrix

Soll-Zustand aus der Produktspezifikation gegen den **belegten** Ist-Stand.

Jede Zeile ist am Code oder gegen die Live-API geprüft, nicht geschätzt.
Was ich nicht geprüft habe, steht als „ungeprüft" da — nicht als „vorhanden".

Stand: 2026-08-10 · Commit `2fe973f` · PR #33 inklusive CI und pgTAP vollständig grün

Legende: ✅ vorhanden und verifiziert · 🟡 teilweise · ❌ fehlt ·
🔒 extern blockiert (siehe `docs/BLOCKERS.md`)

---

## 1. Instrumentuniversum

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Dynamischer Instrumentkatalog statt Mini-Universum | 🟡 | Suchgetrieben implementiert. Vollabzug 🔒 BLOCKER-001 |
| Provider-Verzeichnis-Sync | 🔒 | Alle Directory-Endpunkte 403/402 |
| Instrument Master persistiert | ✅ | `instruments`, Migration `20260807190000` |
| Kanonische ID, Mehrfachlisting getrennt | ✅ | Live: AAPL/NASDAQ, AAPL.DE/XETRA, APC.F/FSX |
| Entity Resolution mit Konfidenz | 🟡 | Symbol + Börse ja; ISIN/FIGI 🔒 nicht im Tarif |
| Identifikatoren ISIN, FIGI, CUSIP, SEDOL, LEI | 🔒 | `stable/search-isin` = 402 |
| Corporate Actions, Symboländerungen, Delistings | 🟡 | Provider-gemeldete Dividenden/Splits mit Ledger, RLS, API und Asset-Timeline; Symboländerungen, Fusionen und Delistings bleiben ohne belastbare Quelle offen |
| Börsenkalender und Sitzungsstatus | 🟡 | Provider-Schicht, defensive Normalisierung, Feiertagsprüfung und UI sind integriert; ohne vollständige Handelszeiten-/Feiertagsabdeckung bleibt der Status ausdrücklich unbekannt |
| Assetklassen Aktie/ETF/Krypto/Forex/Index/Rohstoff | 🟡 | Erkannt und klassifiziert; Anleihen, Optionen, Futures, Zertifikate ❌ |

## 2. Daten und Provenance

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Quelle, asOf, Qualität pro Datenpunkt | ✅ | `asset-provenance.ts`, `data-quality.ts` |
| Realtime/delayed/EOD/mock sichtbar getrennt | ✅ | 6 Qualitätsstufen, in UI durchgezogen |
| Stale-Erkennung | ✅ | `provider-cache.ts`, Stale-TTL |
| Provider-Health, Failover, Circuit Breaker | ✅ | `provider-health.ts`, Backoff in `market-provider.ts` |
| Kursverfügbarkeit pro Instrument | ✅ | Gemessen, nicht geraten. `quote_status` |
| Datenqualitätsprüfungen (Ausreißer, Einheiten, Währung) | 🟡 | Basisprüfungen vorhanden; Bilanzgleichungen, Look-ahead ❌ |
| Point-in-Time-Daten | 🟡 | Historienvertrag, Cutoff und Bias-Gate vorhanden; echte Vintages und Revisionsmodell fehlen 🔒 |
| Realtime-Lizenz | 🔒 | BLOCKER-002 |

## 3. Analyse

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Renditen, Volatilität, Drawdown | ✅ | `portfolio-analytics.ts`, getestet |
| Risikomodul | ✅ | `risk-engine.ts`, getestet |
| Scoring | ✅ | `scoring.ts`, getestet |
| Technische Analyse Mehrzeitrahmen | 🟡 | Indikatoren in `market-provider.ts`; Volumenprofil, Marktstruktur ❌ |
| Fundamentalanalyse | 🟡 | `fundamentals-provider.ts`; Segmente, Guidance, Revisionen ❌ |
| Bewertungsmodelle DCF, FCFF, DDM, SOTP | 🟡 | Zwei-Phasen-DCF auf freiem Cashflow, Reverse DCF, Sensitivitätsband und Renditevergleich sind deterministisch implementiert; eigenständige FCFF-WACC-, DDM- und SOTP-Modelle fehlen |
| Sektorspezifische Kennzahlen (Banken, SaaS, REITs …) | ❌ | Nicht implementiert |
| Optionen, Greeks, IV | ❌ | Keine Daten, kein Modell |
| Anleihen, Duration, Convexity | ❌ | Keine Daten, kein Modell |
| Makro- und Regimeanalyse | 🟡 | FRED-/EZB-Provider, Makroseite und Quellenstatus vorhanden; systematische Regimeklassifikation und Portfolio-Stresstransmission fehlen |
| Relationship Graph | ❌ | Nicht implementiert |

## 4. Prognosen

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Probabilistisch mit Bandbreiten und Szenarien | ✅ | `forecast-passport.ts`, getestet |
| Daten-Cutoff, Modellversion, Konfidenz | ✅ | Im Ledger-Eintrag |
| Forecast Ledger unveränderlich | ✅ | Tabellen + Immutability-Trigger auf Prod |
| Model Registry, Promotion Gate | ✅ | `model_registry`, Gate-Constraints |
| Outcome-Auswertung nach Horizont | ✅ | `forecast-outcome.ts` + Worker + Cron `/api/forecasts/evaluate` |
| Baseline-Vergleich | ✅ | Naive Baseline (unveränderter Kurs), Modellvorsprung ausgewiesen |
| Walk-Forward-Validierung | ❌ | Braucht Point-in-Time-Daten |
| Modellgüte historisch sichtbar | ✅ | `/track-record`, öffentlich, mit Ehrlichkeitsregeln |
| Kein LLM als Prognosemotor | ✅ | Deterministisch, `forecast-passport.ts` |

**Stand nach dem Outcome-Worker:** Der Kreis ist geschlossen. Prognosen werden
unveränderlich geschrieben, nach Horizontablauf gegen den echten Kurs und eine
naive Baseline ausgewertet und zu einer Modellbilanz aggregiert.

Bewusste Eigenschaften gegen Schönfärberei:
- Mock- und nicht verfügbare Kurse fliessen nie in eine Bilanz ein.
- Unbewertbare Fälle zählen in `forecastCount`, aber nicht in die Quoten. Die
  Bewertungsquote bleibt sichtbar — 90 % Treffer aus 3 von 100 Prognosen ist
  kein gutes Modell.
- Ein zu breites Band gilt genauso als Kalibrierungsfehler wie ein zu enges.
- Unter 20 bewerteten Prognosen wird keine Baseline-Aussage getroffen.

**Verbleibende Lücke:** die Bilanz ist erst aussagekräftig, wenn genug Prognosen
ihren Horizont durchlaufen haben. Der Mechanismus steht, die Aussagekraft
braucht Zeit — mindestens 20 gereifte Prognosen, bei 1M-Horizont also frühestens
in einem Monat. Bis dahin zeigt `/track-record` ausdrücklich „noch keine
ausgewertete Prognose" statt Platzhalterwerten.

## 5. Sicherheit und Recht

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| RLS erzwingt Mandantentrennung | ✅ | Gegen Prod getestet, Rollback sauber |
| Keine Secrets im Client | ✅ | `.env.local` gitignored, `server-only` gesetzt |
| Rate Limiting | ✅ | 31 von 32 Routen, Webhook korrekt ausgenommen |
| Sichere Header, CSP, HSTS | ✅ | `next.config.ts`, vollständig |
| SSRF-Schutz bei Provider-Fetches | ✅ | Allowlist in `http-json.ts` |
| Stripe-Webhook signaturgeprüft, idempotent | ✅ | Body-Cap, Immutability-Trigger |
| DSGVO Export und Löschung | ✅ | Robust gegen fehlende Tabellen |
| RBAC, Adminbereich | ✅ | Servergeprüfte Adminrolle, Konten-/Aboverwaltung, Kosten- und Tarifansicht; unberechtigte API-Zugriffe fail-closed |
| Prompt-Injection-Abwehr getestet | ❌ | KI-Schicht kaum ausgebaut |
| Lizenzmatrix je Quelle | 🟡 | `docs/provider-licensing.md`; nicht vollständig |
| Threat Model dokumentiert | ✅ | `docs/SECURITY_THREAT_MODEL.md` sowie institutionelle Security-Control-Matrix vorhanden |

## 6. Betrieb und Qualität

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Typecheck, Lint grün | ✅ | Verifiziert 2026-08-07 |
| Unit-/Integrationstests | ✅ | 106 Testdateien, 936 Tests im PR-#33-Stand grün |
| Komponententests | 🟡 | 9 von 64 Komponenten mit eigenen Testing-Library-Tests; kritische Datenqualitäts-, Kalender-, Billing- und Track-Record-Aussagen abgedeckt |
| E2E | ✅ | 5 Playwright-Specs, 35 Prüfungen auf Mobile/Desktop grün; ein bewusstes projektfremdes Duplikat übersprungen |
| Coverage ehrlich gemessen | ✅ | `all: true`, 26,56 % über 181 Dateien, Schwellen kalibriert |
| RLS-/pgTAP-Tests ausgeführt | ✅ | Laufen in CI; 5 Suiten, Instrument Master neu abgedeckt |
| Observability, Logs, Metriken | 🟡 | `observability.ts`; keine Dashboards, keine Alerts |
| CI/CD | ✅ | 8 Workflows, PR #16 vollständig grün. Trigger nur auf `main` und PRs dagegen |
| iOS-Build | 🔒 | BLOCKER-004 |

**CI-Stand.** PR #16 läuft grün: StockPilot CI, Database Tests und Vercel.
31 Commits, 122 geänderte Dateien. Der erste Lauf über den Branch hat drei
echte Fehler gefunden — 14 Dependency-Schwachstellen, zwei pgTAP-Bugs und eine
zu hoch geratene Coverage-Schwelle. Alle behoben.

`ci.yml` triggert weiterhin nur auf Push und PR gegen `main`. Für Feature-Branches
ohne PR gibt es damit keine Prüfung.

## 7. Produkt und UX

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Seiten vorhanden | ✅ | 23 Seiten |
| Universelle Suche | 🟡 | Command Palette mit Instrument Master und Provenance |
| Instrumentdetailseite | ✅ | Inklusive ehrlicher Sackgassen-Ansicht |
| Charting | 🟡 | `charts.tsx` eigene SVGs; Prognosebänder, Volumenprofil ❌ |
| Screener über Gesamtuniversum | 🔒 | `company-screener` = 402 |
| Watchlists, Alerts, Portfolio | ✅ | Mit Cloud-Sync und lokalem Fallback |
| Paper Trading, Journal | ❌ | Nicht implementiert |
| Backtesting | 🟡 | Echte Historie, Adjusted-Close-Erkennung und Mischreihen-Sperre; Point-in-Time-Vintages fehlen |
| Drei Informationsstufen (Einfach/Fortgeschritten/Pro) | 🟡 | Auswahl liegt wie gefordert in den Einstellungen und wird lokal gespeichert; eine konsistente Auswirkung auf alle Ansichten ist noch nicht durchgezogen |
| Berichte exportierbar | 🟡 | Nur DSGVO-Export |
| Accessibility | 🟡 | Mobile Overflow, Navigation und kritische Touch-Ziele automatisiert geprüft; vollständiger WCAG-/Screenreader-/Kontrastaudit bleibt offen |

---

## Priorisierung

Nach Nutzen pro Aufwand, unter Berücksichtigung der Tarifgrenzen:

1. **Lizenz-/Tarifentscheidung für das globale Universum.** Der Code kann einen
   vollständigen Katalog nicht ersetzen; ohne Verzeichnis- und Kursrechte
   bleibt die Kernabdeckung suchgetrieben.
2. **Zielgruppen-Modus wirklich anwenden.** Auswahl und Speicherung stehen,
   aber Sprache, Informationsdichte und Standardmodule müssen appweit davon
   gesteuert werden.
3. **Komponententests ausbauen.** 9 von 64 Komponenten sind direkt abgedeckt;
   Asset-Detail, Dashboard und komplexe Portfolio-Interaktionen bleiben teuer.
4. **Bewertungsmodelle vervollständigen.** DDM nur bei belastbarer
   Dividendenhistorie, SOTP nur bei Segmentdaten und FCFF nur mit sauberem WACC.
5. **`market-provider.ts` aufteilen.** Das große Modul ist getestet, bleibt aber
   ein Wartungs- und Änderungsrisiko.

Bewusst **nicht** als scheinbar fertig priorisiert: Optionen, Anleihen,
Sektormodelle, SOTP und globale Makro-Regime. Ohne lizenzierte Eingabedaten
würden zusätzliche Formeln nur die Differenz zwischen versprochener und
tatsächlicher Abdeckung vergrößern.

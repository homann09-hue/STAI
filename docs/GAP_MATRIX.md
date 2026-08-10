# Gap-Matrix

Soll-Zustand aus der Produktspezifikation gegen den **belegten** Ist-Stand.

Jede Zeile ist am Code oder gegen die Live-API geprüft, nicht geschätzt.
Was ich nicht geprüft habe, steht als „ungeprüft" da — nicht als „vorhanden".

Stand: 2026-08-08 · Commit `91b0880` · CI vollständig grün

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
| Assetklassen Aktie/ETF/Krypto/Forex/Index/Rohstoff | 🟡 | Erkannt und klassifiziert; Anleihen, Optionen, Futures, Zertifikate ❌ |
| Handelskalender, Sessions, Feiertage | ❌ | Nicht implementiert |

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
| Bewertungsmodelle DCF, FCFF, DDM, SOTP | ❌ | Nicht implementiert |
| Sektorspezifische Kennzahlen (Banken, SaaS, REITs …) | ❌ | Nicht implementiert |
| Optionen, Greeks, IV | ❌ | Keine Daten, kein Modell |
| Anleihen, Duration, Convexity | ❌ | Keine Daten, kein Modell |
| Makro- und Regimeanalyse | ❌ | Nicht implementiert |
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
| RBAC, Adminbereich | ❌ | `admin-access.ts` vorhanden, keine Admin-UI |
| Prompt-Injection-Abwehr getestet | ❌ | KI-Schicht kaum ausgebaut |
| Lizenzmatrix je Quelle | 🟡 | `docs/provider-licensing.md`; nicht vollständig |
| Threat Model dokumentiert | ❌ | `docs/SECURITY_THREAT_MODEL.md` fehlt |

## 6. Betrieb und Qualität

| Anforderung | Status | Beleg / Grund |
|---|---|---|
| Typecheck, Lint grün | ✅ | Verifiziert 2026-08-07 |
| Unit-Tests | 🟡 | 49 Dateien, 275 Tests |
| Komponententests | 🟡 | Setup steht (happy-dom + Testing Library); 2 von 40 Komponenten abgedeckt, beide zu 100 % |
| E2E | 🟡 | 5 Playwright-Specs, in dieser Session nicht ausgeführt |
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
| Drei Informationsstufen (Einfach/Fortgeschritten/Pro) | ❌ | Nicht implementiert |
| Berichte exportierbar | 🟡 | Nur DSGVO-Export |
| Accessibility | ❌ | Nie geprüft |

---

## Priorisierung

Nach Nutzen pro Aufwand, unter Berücksichtigung der Tarifgrenzen:

1. **Forecast-Outcome-Auswertung.** Der Ledger schreibt bereits. Ein Job, der
   nach Horizontablauf das Ergebnis vergleicht, macht aus vorhandener Infra das
   einzige echt differenzierende Feature. Kein Tarif nötig.
2. **Coverage kalibrieren.** Ein Lauf, dann sind die Schwellen ehrlich.
3. **Komponententests.** 10.700 Zeilen Client-Code ohne einen einzigen Test.
4. **Tarifentscheidung.** Alles unter Punkt 1 im Universum-Block hängt daran.
5. **`market-provider.ts` aufteilen.** 1.696 Zeilen, jetzt mit lauffähiger
   Testsuite vertretbar.

Bewusst **nicht** priorisiert: weitere Analysemodule (Optionen, Anleihen,
Sektormodelle, Makro). Sie hätten dasselbe schmale Datenfundament und würden die
Differenz zwischen versprochener und tatsächlicher Abdeckung vergrößern.

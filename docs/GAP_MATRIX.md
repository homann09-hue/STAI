# Gap-Matrix

Soll-Zustand aus der Produktspezifikation gegen den **belegten** Ist-Stand.

Jede Zeile ist am Code oder gegen die Live-API geprüft, nicht geschätzt.
Was ich nicht geprüft habe, steht als „ungeprüft" da — nicht als „vorhanden".

Stand: 2026-08-07 · Commit `c3d12a8`

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
| Corporate Actions, Symboländerungen, Delistings | ❌ | Kein Datenmodell, keine Quelle |
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
| Point-in-Time-Daten | ❌ | Kein Revisionsmodell. Blockiert seriöses Backtesting |
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
| Outcome-Auswertung nach Horizont | ❌ | Tabelle da, kein Job der sie füllt |
| Walk-Forward-Validierung, Baselines | ❌ | Nicht implementiert |
| Modellgüte historisch sichtbar | ❌ | `model_evaluations` leer |
| Kein LLM als Prognosemotor | ✅ | Deterministisch, `forecast-passport.ts` |

**Wichtigste Lücke im Bereich:** der Ledger schreibt, aber niemand wertet aus.
Ohne Outcome-Vergleich ist die überprüfbare Trefferbilanz — das eigentlich
Differenzierende — nicht vorhanden.

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
| Unit-Tests | 🟡 | 42 Dateien, 193 Tests — alle in `src/lib` |
| Komponententests | ❌ | 40 Komponenten, 0 Tests |
| E2E | 🟡 | 5 Playwright-Specs, in dieser Session nicht ausgeführt |
| Coverage ehrlich gemessen | 🟡 | `all: true` gesetzt, Schwellen **nicht kalibriert** |
| RLS-/pgTAP-Tests ausgeführt | 🔒 | BLOCKER-003, Ersatznachweis gegen Prod |
| Observability, Logs, Metriken | 🟡 | `observability.ts`; keine Dashboards, keine Alerts |
| CI/CD | 🟡 | 8 Workflows. `ci.yml` fährt format/typecheck/lint/test:coverage/build/performance — **aber nur auf `main`** |
| iOS-Build | 🔒 | BLOCKER-004 |

**Achtung CI.** `ci.yml` triggert ausschließlich auf Push und PR gegen `main`.
Der aktive Branch `codex/enterprise-saas-billing-20260711` liegt seit 16 Commits
neben `main` und hat **nie eine CI-Prüfung gesehen**. Beim Merge laufen alle
Gates zum ersten Mal — inklusive `npm run test:coverage`, dessen Schwellen nach
der `all: true`-Umstellung noch nicht kalibriert sind.

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
| Backtesting | 🟡 | UI vorhanden; ohne Point-in-Time-Daten nicht belastbar |
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

# Fortschrittsmatrix — Soll-Ist gegen `docs/MASTERPROMPT.md`

Stand: 2026-08-08 · Branch `codex/enterprise-saas-billing-20260711` · Commit `5e7d3d7`

**Zustände**

| Zustand | Bedeutung |
|---|---|
| `NOT STARTED` | Nicht begonnen |
| `IN PROGRESS` | Teilweise vorhanden, nicht abgeschlossen |
| `BLOCKED` | Blockiert durch etwas außerhalb des Codes (siehe `docs/BLOCKERS.md`) |
| `DONE` | Implementiert, aber noch nicht nach §98 vollständig überprüft |
| `VERIFIED` | Implementiert, getestet, Fehlerfälle behandelt, Build und CI grün |

Ein Punkt wird nur dann `VERIFIED`, wenn die Umsetzung technisch überprüft wurde.
Geschätzte Zustände gibt es hier nicht — jede Zeile nennt ihren Beleg.

---

## Die drei größten Blocker für den kommerziellen Launch

### 1. Bezahlinhalte waren serverseitig nicht geschützt — behoben

**Befund** (gemessen am 2026-08-08 im Code, nicht geschätzt):

- Keine `middleware.ts` im Projekt.
- **Keine einzige Seite** unter `src/app` prüft Anmeldung oder Tarif.
  `grep "getSupabaseAuth\|getUserEntitlements\|cookies()" src/app/**/page.tsx`
  liefert null Treffer.
- `app/markets/page.tsx` und `app/risk/page.tsx` rufen
  `getProfessionalDataProvider().getMarketReport()` direkt in der Server-Komponente
  auf. Der Profi-Terminal-Inhalt steht damit im HTML — auch für nicht angemeldete
  Besucher.
- `GET /api/professional/overview` prüft ausschließlich das Rate Limit. Keine
  Anmeldung, kein Tarif.
- Von 35 API-Routen setzen genau **drei** Entitlements durch (`watchlist`,
  `alerts`, `portfolio/books`) — und auch nur Mengenbegrenzungen.

Der Entitlement-Kern ist sauber gebaut, wird aber nur zur Anzeige verwendet. Die
Feature-Karte `entitlements.features` wird berechnet, an den Client geliefert und
dort ausgewertet. Das verletzt §4 direkt: „Der Client darf niemals selbst
bestimmen können, welchen Tarif ein Nutzer besitzt."

**Wirtschaftliche Folge:** Pro-Inhalte waren ohne Konto abrufbar. Ein Tarif,
dessen Leistung anonym erreichbar ist, lässt sich nicht verkaufen.

**Behebung** (Commit vom 2026-08-08):

- `src/lib/billing/feature-access.ts` — reine Zugriffsentscheidung, fail closed.
- `src/lib/billing/feature-guard.ts` — serverseitige Durchsetzung.
- `GET /api/professional/overview` prüft jetzt Anmeldung und Tarif.
- Alle sieben Profi-Ansichten (`/markets`, `/stocks`, `/etfs`, `/crypto`,
  `/news-terminal`, `/risk`, `/compare`) beziehen den Bericht über diese Route
  statt ihn in der Server-Komponente zu rendern.
- Gegatete Antworten sind `private, no-store`. Mit `s-maxage` hätte das CDN den
  Bezahlinhalt nach einem berechtigten Aufruf an alle weiteren ausgeliefert.

**Nachweis:** Gegen den Produktionsbuild geprüft — `/markets` enthält im HTML
keinen Profi-Inhalt mehr, `/api/professional/overview` antwortet ohne Konto mit
401 und `X-StockPilot-Required-Plan: pro`. 19 neue Tests; der Routentest wurde
gegengeprüft, indem der Guard entfernt wurde: drei Zusicherungen wurden rot.

Details: `docs/ENTITLEMENTS.md`.

### 2. Kein Rechnungs- und Verwaltungsbereich

`grep -i invoice src` liefert null Treffer. Es gibt keinen Bereich
Account → Billing. Abo-Verwaltung existiert nur als Weiterleitung ins
Stripe-Portal auf `/pricing`. §6 verlangt Tarif, Preis, nächste Abrechnung,
Zahlungsstatus, Zahlungsmethode, Rechnungen, Upgrade, Downgrade, Kündigung.

### 3. Kein Jahresabo

`grep -i "yearly\|annual" src/lib/billing` liefert null Treffer. Es gibt nur
`STRIPE_STARTER_PRICE_ID` und `STRIPE_PRO_PRICE_ID`, beide monatlich. §3 und §5
verlangen ein günstigeres Jahresabo.

---

## Kommerz und Zugang

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §2 | SaaS-Ablauf ohne manuellen Eingriff | `IN PROGRESS` | Checkout, Portal, Webhook vorhanden. Freischaltung wirkt nicht auf Inhalte (Blocker 1) |
| §3 | Tarifstruktur zentral konfigurierbar | `DONE` | `src/lib/feature-gates.ts`, eine Datei, vier Tarife |
| §3 | Tarifnamen/Preise laut Masterprompt | `IN PROGRESS` | Ist: free / starter 9 € / pro 29 € / elite auf Anfrage. Soll: FREE / PRO 29,99 / PREMIUM 59,99–79,99. Preisentscheidung liegt beim Inhaber |
| §3 | Jahresabo | `NOT STARTED` | Blocker 3 |
| §4 | Zentrale Entitlement-Definition | `DONE` | `feature-gates.ts` + `billing/entitlements.ts`, 11 Features, 5 Limits |
| §4 | Backend erzwingt dieselben Rechte wie das Frontend | `DONE` | `feature-guard.ts`; `pro_terminal` durchgesetzt und gegen den Produktionsbuild geprüft. Noch nicht `VERIFIED`, weil erst eine von elf Funktionen eine gegatete Route hat |
| §4 | Limits `maxWatchlists`, `maxSavedScreeners`, `historicalDataYears` | `NOT STARTED` | Nicht im Limitmodell |
| §4 | Limits `aiAnalysesPerDay`, `apiRequestsPerDay` | `IN PROGRESS` | Definiert, aber nirgends geprüft — null Treffer im Code |
| §5 | Webhook signaturgeprüft und idempotent | `VERIFIED` | `api/billing/webhook`, Body-Cap, `billing_events`-Dedupe, Immutability-Trigger, pgTAP |
| §5 | Statusabbildung active/trialing/past_due/canceled/unpaid/incomplete | `DONE` | `stripe-events.ts`, `normalizeBillingStatus` |
| §5 | Checkout, Kundenportal | `DONE` | Redirect-Allowlist auf `checkout.stripe.com`/`billing.stripe.com` |
| §5 | Rechnungen, Gutscheine, Testphasen | `NOT STARTED` | Blocker 2 |
| §5 | Upgrade/Downgrade im Produkt | `IN PROGRESS` | Nur über Stripe-Portal; Checkout blockt bei aktivem Abo mit 409 |
| §6 | Bereich Account → Billing | `NOT STARTED` | Blocker 2 |
| §6 | Verständliche Paywall statt kryptischem Fehler | `DONE` | `paywall-notice.tsx` nennt Funktion, Tarif, Preis, Mehrwert und Weg; kein Upgrade-Knopf ohne konfigurierten Checkout. Komponententest fehlt noch |
| §7 | Kosten- und Cache-Steuerung | `IN PROGRESS` | `cost-controls.ts`, `provider-cache.ts` vorhanden |
| §7 | Kosten je Nutzer und je Tarif messbar | `NOT STARTED` | Keine Zuordnung von Providerkosten zu Nutzern |
| §64 | Adminbereich | `NOT STARTED` | `admin-access.ts` schützt Endpunkte, keine Oberfläche |
| §65 | Feature Flags | `NOT STARTED` | Null Treffer im Code |

## Daten

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §20 | Instrumentuniversum über Aktien hinaus | `IN PROGRESS` | Aktien, ETF, Krypto, Forex, Index, Rohstoff erkannt. Anleihen, Optionen, Futures fehlen |
| §20 | Vollständiger Symbolabzug | `BLOCKED` | BLOCKER-001, FMP-Tarif |
| §21 | Provider-Abstraktion mit Fallback | `DONE` | `market-provider.ts`, `provider-health.ts`, Circuit Breaker |
| §21 | Provider-Dokumentation je Quelle | `IN PROGRESS` | `docs/provider-licensing.md` unvollständig |
| §22 | Quelle, Timestamp, Qualität je Datensatz | `VERIFIED` | `asset-provenance.ts`, `data-quality.ts`, in UI durchgezogen |
| §22 | Point-in-Time-Historie | `NOT STARTED` | Ohne sie ist Backtesting nicht belastbar |
| §23 | Realtime/Streaming | `BLOCKED` | BLOCKER-002, Lizenz |
| §54 | Schema, Indizes, Constraints | `VERIFIED` | pgTAP, 5 Suiten, 103 Zusicherungen, CI Run #20 |
| §55 | RLS, Policies, Service Role | `VERIFIED` | Gegen Produktion getestet, Rollback sauber, Advisor ohne Findings |
| §66 | Provider Health Monitoring | `DONE` | `provider-health.ts`, Oberfläche vorhanden |
| §67 | Data Confidence | `DONE` | `data-quality.ts` |
| §68 | Forecast Confidence getrennt von Data Quality | `VERIFIED` | `forecast-passport.ts`, `forecast-track-record.ts`, Komponententests |

## Analyse

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §24 | Fundamentalanalyse | `IN PROGRESS` | `fundamentals-provider.ts`. Segmente, Guidance, Revisionen fehlen |
| §25 | Erklärbare Scores | `DONE` | `scoring.ts`, getestet |
| §26 | Technische Analyse | `IN PROGRESS` | Indikatoren vorhanden, Mehrzeitrahmen unvollständig |
| §27 | News und Events | `IN PROGRESS` | `news`-Route, Klassifikation unvollständig |
| §28/§29 | Makro, Zentralbanken | `NOT STARTED` | Kein Modul |
| §30 | Sentiment | `IN PROGRESS` | Teilweise über News |
| §31–§35 | Filings, Insider, Analysten, Short Interest, Optionen | `NOT STARTED` | Keine Datenquelle im Tarif |
| §36 | Peer-Analyse | `NOT STARTED` | — |
| §37 | Bewertungsmodelle DCF/Multiples | `NOT STARTED` | — |
| §38 | Szenarien mit Bandbreiten | `VERIFIED` | `forecast-passport.ts`, keine Punktziele |
| §39 | Forecast-Transparenz | `VERIFIED` | Ledger mit Cutoff, Modellversion, Input-Digest |
| §40 | Risikoanalyse | `DONE` | `risk-engine.ts`, getestet |
| §60 | Finanzmathematik geprüft | `IN PROGRESS` | Kernfunktionen getestet, keine vollständige Revision |
| §70–§74 | Change Detection, Anomalien, Regime, Benchmarking | `NOT STARTED` | — |
| §101 | Kein LLM als Prognosemotor | `VERIFIED` | Deterministisch |

## Produkt und Oberfläche

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §41–§43 | Watchlist, Alerts, Portfolio | `DONE` | Cloud-Sync mit lokalem Rückfall |
| §44 | Backtesting | `IN PROGRESS` | Oberfläche vorhanden, ohne Point-in-Time nicht belastbar |
| §45 | Mehrdimensionales Signalsystem | `DONE` | Keine simplen BUY/SELL-Ausgaben |
| §46 | Market Dashboard | `DONE` | — |
| §47 | Screener über Gesamtuniversum | `BLOCKED` | BLOCKER-005, `company-screener` = 402 |
| §48 | Globale Suche | `IN PROGRESS` | Command Palette mit Herkunft; ISIN blockiert |
| §49 | Asset-Seiten | `DONE` | Inklusive ehrlicher Sackgassen-Ansicht |
| §51 | Design | `IN PROGRESS` | Eigenständig, nicht systematisch geprüft |
| §52 | Mobile/PWA | `IN PROGRESS` | Manifest vorhanden, nie auf Geräten geprüft |
| §79 | i18n de/en | `NOT STARTED` | Oberfläche durchgängig deutsch |
| §81/§82/§83 | Export, Sharing, Workspaces | `NOT STARTED` | Nur DSGVO-Export |
| §102–§105 | Trading-Bot, Paper Trading, Strategy/Risk Engine | `NOT STARTED` | `risk-engine.ts` deckt Analyse ab, nicht Ausführung |

## Technik und Betrieb

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §53 | Performance | `IN PROGRESS` | `performance-budget.mjs` vorhanden, Bundle nie analysiert |
| §56 | Security Audit | `IN PROGRESS` | RLS, CSP, SSRF-Allowlist, Rate Limits `VERIFIED`. IDOR/Billing-Manipulation: Blocker 1 offen |
| §57 | Fehlerbehandlung | `DONE` | Error Boundaries, Backoff, Failover |
| §58 | Observability | `IN PROGRESS` | `observability.ts`; keine Dashboards, keine Alarme |
| §59 | Tests | `IN PROGRESS` | 49 Dateien, 275 Tests; Komponenten 2 von 40; E2E 5 Specs ungelaufen |
| §63 | DSGVO | `DONE` | Export und Löschung, robust gegen fehlende Tabellen |
| §84 | Codequalität | `IN PROGRESS` | `market-provider.ts` mit 1.696 Zeilen ungeteilt |
| §86 | Dependencies | `VERIFIED` | 0 Schwachstellen, Dependabot entsperrt |
| §87 | Edge Cases | `IN PROGRESS` | Datenseitig gut abgedeckt, Billing-Edge-Cases ungetestet |
| §88 | Red Team | `IN PROGRESS` | Erster Durchgang hat Blocker 1 gefunden |
| §17 | CI/CD | `VERIFIED` | PR #16 vollständig grün, Run #20 |
| §99/§100 | Dokumentation, `.env.example` | `IN PROGRESS` | `.env.example` gepflegt; Billing-Doku fehlt |

---

## Nächste Schritte, priorisiert

Reihenfolge nach §85: Korrektheit → Sicherheit → Stabilität → Datenqualität →
Billing → Performance → UX → neue Features.

1. ~~Serverseitige Feature-Entitlements erzwingen (Blocker 1).~~ Erledigt für
   `pro_terminal`. Offen: die übrigen zehn Features haben noch keine gegatete
   Route, weil es für sie noch keine gibt.
2. ~~Ehrliche Paywall statt 403 ohne Erklärung (§6).~~ Erledigt.
3. **Tagesquoten durchsetzen** (`aiAnalysesPerDay`) — definiert, aber wirkungslos (§7).
4. **Account → Billing mit Rechnungen** (Blocker 2, §6).
5. **Jahresabo** (Blocker 3, §3/§5).
6. **Billing-Edge-Cases testen**: doppelter Webhook, fehlgeschlagene Zahlung,
   Kündigung, Downgrade, gelöschtes Konto (§87).
7. **`market-provider.ts` aufteilen** (§84) — jetzt mit lauffähiger Testsuite
   vertretbar.
8. **Komponententests** auf die verbleibenden 38 Komponenten (§59).

Bewusst **nicht** priorisiert: weitere Analysemodule (Optionen, Anleihen, Makro,
Sektormodelle). Sie stünden auf demselben schmalen Datenfundament und würden die
Differenz zwischen versprochener und tatsächlicher Abdeckung vergrößern.

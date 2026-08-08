# Fortschrittsmatrix — Soll-Ist gegen `docs/MASTERPROMPT.md`

Stand: 2026-08-08 · Branch `codex/enterprise-saas-billing-20260711` · Commit `da2d027`
· PR #16 mit vier bestandenen Checks

Letzter Abgleich mit `docs/MASTERPROMPT.md`: 2026-08-08 nach dem
Entitlement-Fix. Dabei neu gemessen: der Launch-Check nach §110 (unten) und die
Auth-Verfahren.

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

### 2. Kein Rechnungs- und Verwaltungsbereich — behoben

**Befund:** `grep -i invoice src` lieferte null Treffer. Abo-Verwaltung
existierte nur als Weiterleitung ins Stripe-Portal auf `/pricing`.

**Behebung:** `/account/billing` zeigt alle neun Angaben aus §6. Rechnungen
kommen über `GET /api/billing/invoices`; die Kundennummer stammt
ausschließlich aus den serverseitig gelesenen Entitlements, nie aus der
Anfrage — sonst wäre es ein IDOR im empfindlichsten Bereich der Anwendung.
Rechnungslinks werden gegen `*.stripe.com` geprüft, bevor sie als Link im
Browser landen.

**Offen bleibt:** Gutscheine und Testphasen sind in Stripe möglich, aber im
Produkt nicht angebunden.

### 3. Kein Jahresabo — Code steht, Preise fehlen

**Befund:** `grep -i "yearly|annual" src/lib/billing` lieferte null Treffer.

**Behebung:** Tarife, Checkout, Anzeige und Preisableitung kennen jetzt Monat
und Jahr. Vier Umgebungsvariablen sind vorgesehen:
`STRIPE_PRO_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID`,
`STRIPE_PREMIUM_PRICE_ID`, `STRIPE_PREMIUM_YEARLY_PRICE_ID`.

**Offen:** die Preis-IDs müssen in Stripe angelegt und gesetzt werden. Das ist
eine Preisentscheidung und gehört dem Projektinhaber. Bis dahin ist der
jeweilige Zeitraum schlicht nicht buchbar — und erscheint auch nicht als Knopf,
weil ein Knopf ohne hinterlegten Preis eine Funktionsattrappe wäre.

---

## Kommerz und Zugang

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §2 | SaaS-Ablauf ohne manuellen Eingriff | `IN PROGRESS` | Checkout, Portal, Webhook vorhanden. Freischaltung wirkt nicht auf Inhalte (Blocker 1) |
| §3 | Tarifstruktur zentral konfigurierbar | `DONE` | `src/lib/feature-gates.ts`, eine Datei, vier Tarife |
| §3 | Tarifnamen/Preise laut Masterprompt | `DONE` | FREE / PRO 29,99 € / PREMIUM 69,99 € (Monat) plus Jahrespreise. Vom Inhaber am 2026-08-08 entschieden |
| §3 | Jahresabo | `IN PROGRESS` | Code, Checkout und Anzeige stehen. Es fehlen nur die Preis-IDs aus Stripe — ohne sie ist der Zeitraum nicht buchbar und erscheint auch nicht |
| §4 | Zentrale Entitlement-Definition | `DONE` | `feature-gates.ts` + `billing/entitlements.ts`, 11 Features, 5 Limits |
| §4 | Backend erzwingt dieselben Rechte wie das Frontend | `DONE` | `feature-guard.ts`; `pro_terminal` durchgesetzt und gegen den Produktionsbuild geprüft. Noch nicht `VERIFIED`, weil erst eine von elf Funktionen eine gegatete Route hat |
| §4 | Limits `maxWatchlists`, `maxSavedScreeners`, `historicalDataYears` | `IN PROGRESS` | Im Limitmodell nach §4 benannt und je Tarif gesetzt; noch keine Route setzt sie durch |
| §4 | Limits `aiAnalysesPerDay`, `apiRequestsPerDay` | `DONE` | `usage-quota.ts` + `consume_feature_quota`, atomar in einer Anweisung. Gegen Produktion gemessen, 18 pgTAP-Zusicherungen. `apiRequestsPerDay` hat noch keine Route |
| §5 | Webhook signaturgeprüft und idempotent | `VERIFIED` | `api/billing/webhook`, Body-Cap, `billing_events`-Dedupe, Immutability-Trigger, pgTAP |
| §5 | Statusabbildung active/trialing/past_due/canceled/unpaid/incomplete | `DONE` | `stripe-events.ts`, `normalizeBillingStatus` |
| §5 | Checkout, Kundenportal | `DONE` | Redirect-Allowlist auf `checkout.stripe.com`/`billing.stripe.com` |
| §5 | Rechnungen | `DONE` | `GET /api/billing/invoices`, Kundennummer nur serverseitig. 15 Tests |
| §5 | Gutscheine, Testphasen | `NOT STARTED` | Stripe kann beides; im Produkt nicht angebunden |
| §5 | Upgrade/Downgrade im Produkt | `DONE` | Einstieg in `/account/billing`, Ausführung im Kundenportal — dort sind anteilige Verrechnung und Widerruf gelöst |
| §6 | Bereich Account → Billing | `DONE` | `/account/billing`: Tarif, Preis, nächste Abrechnung, Status, Zahlungsmethode, Rechnungen, Wechsel, Kündigung |
| §6 | Verständliche Paywall statt kryptischem Fehler | `DONE` | `paywall-notice.tsx` nennt Funktion, Tarif, Preis, Mehrwert und Weg; kein Upgrade-Knopf ohne konfigurierten Checkout. Komponententest fehlt noch |
| §7 | Kosten- und Cache-Steuerung | `DONE` | `cost-controls.ts`, `provider-cache.ts`, Tagesquoten je Konto, gemessene Cache-Trefferquote |
| §7 | Kostenmodell und Margenbewertung | `DONE` | `cost/provider-costs.ts`: Kosten je Abruf mit Herleitung, Cache-Ersparnis, Marge gegen Tarifertrag. 15 Tests |
| §7 | Kosten je Nutzer und je Tarif gemessen | `DONE` | `provider_usage` zählt je Tag, Konto, Tarif und Anbieter. `GET /api/admin/cost-metrics` liefert Cache-Quote, Kosten je Tarif und die teuersten Konten mit Margenurteil. 14 pgTAP-Zusicherungen |
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
| §28 | Makro | `DONE` | EZB Data Portal ohne Schlüssel und ohne Tarif. Fünf Reihen live gemessen, Zinsstrukturbewertung, Datenalter je Reihe. `GET /api/macro` und Seite `/macro`, in der Navigation. 32 Tests |
| §28 | Economic Calendar | `NOT STARTED` | Terminreihen noch nicht angebunden |
| §29 | Zentralbanken: Zinsentscheidungen | `DONE` | Aus dem Leitzinspfad abgeleitet, 2-Jahres-Fenster. Live: 9 Entscheidungen seit 2024-09. `policy-rate-history.ts`, 13 Tests |
| §29 | Zentralbanken: Sitzungstermine, Statements, Protokolle | `NOT STARTED` | Aus einem Zinspfad nicht ableitbar, braucht eine Terminquelle |
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
| §19 | Nutzerflüsse als Testziel | `IN PROGRESS` | Abo-Lebenszyklus deterministisch geprüft (16 Tests). Registrierung, Login, Checkout und Webhook-Zustellung brauchen ein Stripe-Konto und bleiben offen |
| §59 | Tests | `IN PROGRESS` | 49 Dateien, 275 Tests; Komponenten 2 von 40; E2E 5 Specs ungelaufen |
| §63 | DSGVO | `DONE` | Export und Löschung, robust gegen fehlende Tabellen |
| §84 | Codequalität | `IN PROGRESS` | `market-provider.ts` mit 1.696 Zeilen ungeteilt |
| §86 | Dependencies | `VERIFIED` | 0 Schwachstellen, Dependabot entsperrt |
| §87 | Edge Cases | `DONE` | `subscription-lifecycle.test.ts`: Kündigung, fehlgeschlagene Zahlung, Upgrade, Testphase, manipulierte Datensätze. 16 Zusicherungen |
| §88 | Red Team | `IN PROGRESS` | Erster Durchgang hat Blocker 1 gefunden |
| §17 | CI/CD | `VERIFIED` | Beide Workflows jetzt auf jedem Push und PR, nicht nur `main`. Produktions-Autodeploy aus Git abgeschaltet — Produktion läuft nur noch über den gegateten Workflow. Branch Protection bleibt eine GitHub-Einstellung, siehe `docs/CI_PIPELINE.md` |
| §99/§100 | Dokumentation, `.env.example` | `IN PROGRESS` | `.env.example` gepflegt; Billing-Doku fehlt |

---

## §110 Launch-Check

Der Masterprompt nennt 22 Punkte, die vor dem Verkauf als Abo geprüft sein
müssen. Diese Liste war nirgends abgearbeitet. Stand 2026-08-08, jeweils am Code
gemessen:

| Punkt | Status | Beleg |
|---|---|---|
| Registrierung funktioniert | `IN PROGRESS` | Es gibt keine Registrierung als eigenen Schritt. Der erste Magic Link legt das Konto implizit an — funktioniert, ist aber als Registrierung nicht erkennbar |
| Login funktioniert | `DONE` | Magic Link über `supabase-auth-panel.tsx` |
| E-Mail-/Passwort-Flows | `NOT STARTED` | `signInWithPassword` und `signUp` kommen im gesamten Code nicht vor |
| Passwort-Reset | `NOT STARTED` | `resetPasswordForEmail` kommt nicht vor. Ohne Passwort auch nicht nötig — das ist eine Produktentscheidung, siehe unten |
| Stripe Checkout | `DONE` | Route und Redirect-Allowlist vorhanden. Ob die Preis-IDs in Produktion gesetzt sind, weiß nur der Projektinhaber |
| Subscription Sync | `VERIFIED` | Signaturgeprüfter, idempotenter Webhook; pgTAP auf `billing_events` |
| Tarifberechtigungen | `DONE` | Serverseitig durchgesetzt, gegen den Produktionsbuild geprüft |
| Upgrade | `IN PROGRESS` | Nur über das Stripe-Portal |
| Downgrade | `IN PROGRESS` | Nur über das Stripe-Portal |
| Kündigung | `IN PROGRESS` | Nur über das Stripe-Portal; `cancelAtPeriodEnd` wird auf `/pricing` angezeigt |
| Zahlungsfehler werden behandelt | `IN PROGRESS` | `past_due`/`unpaid` werden abgebildet, aber dem Nutzer nirgends erklärt |
| Rechnungen erreichbar | `NOT STARTED` | Keine Rechnungsansicht im Produkt |
| Account-Löschung | `DONE` | `DELETE /api/account`, DSGVO-Pfad |
| Kernanalysen funktionieren | `DONE` | Getestet |
| Daten aktuell und nachvollziehbar | `VERIFIED` | Provenance und Datenqualität durchgezogen |
| Keine Demo-Daten in Produktion | `DONE` | Mock ist als Qualitätsstufe sichtbar getrennt |
| Mobile Nutzung brauchbar | `NOT STARTED` | Nie auf einem Gerät geprüft |
| Error Handling | `DONE` | Error Boundaries, Failover, Backoff |
| Security Audit | `IN PROGRESS` | Erster Red-Team-Durchgang hat den Entitlement-Blocker gefunden |
| DSGVO-Flows | `DONE` | Export und Löschung |
| CI grün | `VERIFIED` | PR #16 auf `da2d027`, vier Checks bestanden |
| Production Build | `VERIFIED` | `npm run build` erfolgreich, Route-Manifest geprüft |

### Neue Erkenntnis: die Anmeldung ist Magic-Link-only

Das ist kein Fehler, aber es verändert drei Punkte des Launch-Checks. StockPilot
kennt kein Passwort — es gibt weder Registrierung noch Passwort-Reset, weil es
nichts zurückzusetzen gibt. Das ist ein verbreitetes und verteidigbares Modell.

Was daran offen ist, gehört dem Projektinhaber:

1. Soll es zusätzlich E-Mail/Passwort geben? Dann kommen Registrierung,
   Reset und Verifikation als eigene Flows dazu.
2. Es gibt **keine eigene Login-Seite**. Die Anmeldung sitzt im
   Einstellungsbereich. Für einen zahlenden Erstbesucher ist das ein Umweg —
   die Paywall verlinkt deshalb jetzt ausdrücklich dorthin, aber eine eigene
   Seite `/login` wäre der sauberere Weg.

---

## Nächste Schritte, priorisiert

Reihenfolge nach §85: Korrektheit → Sicherheit → Stabilität → Datenqualität →
Billing → Performance → UX → neue Features.

1. ~~Serverseitige Feature-Entitlements erzwingen (Blocker 1).~~ Erledigt für
   `pro_terminal`. Offen: die übrigen zehn Features haben noch keine gegatete
   Route, weil es für sie noch keine gibt.
2. ~~Ehrliche Paywall statt 403 ohne Erklärung (§6).~~ Erledigt.
3. ~~Tagesquoten durchsetzen (`aiAnalysesPerDay`).~~ Erledigt.
4. ~~Account → Billing mit Rechnungen (Blocker 2, §6).~~ Erledigt.
5. **Jahresabo** (Blocker 3, §3/§5).
6. **Billing-Edge-Cases testen**: doppelter Webhook, fehlgeschlagene Zahlung,
   Kündigung, Downgrade, gelöschtes Konto (§87).
7. **`market-provider.ts` aufteilen** (§84) — jetzt mit lauffähiger Testsuite
   vertretbar.
8. **Komponententests** auf die verbleibenden 38 Komponenten (§59).

Bewusst **nicht** priorisiert: weitere Analysemodule (Optionen, Anleihen, Makro,
Sektormodelle). Sie stünden auf demselben schmalen Datenfundament und würden die
Differenz zwischen versprochener und tatsächlicher Abdeckung vergrößern.

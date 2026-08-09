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
| §21 | Provider-Abstraktion mit Fallback | `DONE` | `quote-chain.ts` + `ChainedQuoteProvider`. Finnhub als zweite Quelle konfiguriert und live geprüft — Kette meldet `fmp → finnhub`, `hasFailover: true`. In Produktion fehlt der Schlüssel noch |
| §21 | Provider-Dokumentation je Quelle | `IN PROGRESS` | `docs/PROVIDERS.md`: 14 Quellen erfasst. Für 9 davon sind Rate Limits, Kosten, Historie und Lizenz **nie gemessen** — als solche markiert, nicht geraten |
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
| §24 | Fundamentalanalyse | `IN PROGRESS` | Das Scoring-Modell kennt 18 Kennzahlen aus §24. Im Datenmodell liegen davon nur 5 (`peRatio`, `revenueGrowth`, `debtToEquity`, `ebitda`, `grossMargin`) — die übrigen 13 muss der Provider erst liefern |
| §25 | Erklärbare Teilnoten | `DONE` | `analysis/quality-scores.ts`: 7 Dimensionen, 18 Einzelkennzahlen, **keine Gesamtnote**. Fehlende Werte werden benannt statt geschätzt. 15 Tests. Ohne Branchenkalibrierung |
| §26 | Technische Analyse | `DONE` | **Vollständig.** 19 Indikatoren inklusive ADX, Trendkanal und Ausbruch, dazu Analyse über drei Zeitrahmen. Alle drei Erfindungsquellen ersetzt (siehe unten). 56 Tests, neun Regressionen gegengeprüft. Einschränkung: alles auf Tagesbasis — Intraday-Zeitrahmen gibt es nicht, weil der Anbietertarif keine Intraday-Historie enthält |
| §27 | News und Events | `IN PROGRESS` | **Klassifikation und Entdopplung gebaut** (siehe unten): 18 Ereignisarten mit Beleg, Bezug nach Unternehmen/Branche/Land/Index/Rohstoff/Währung/Krypto, Duplikate zusammengeführt. 32 Tests, fünf Regressionen gegengeprüft. Offen: nur eine Quelle liefert Entitäten, NewsAPI keine |
| §28 | Makro | `IN PROGRESS` | **22 Reihen** live gemessen: 11 EZB (Euroraum), 11 FRED (USA, **ohne Schlüssel**), dazu 5 Marktindikatoren. Alles aus §28 abgedeckt außer **PMI**. Offen ist keine Datenlücke, sondern eine Lizenzfrage — siehe unten |
| §28 | Economic Calendar | `BLOCKED` | Keine Quelle im Tarif. FMP `/stable/economic-calendar` antwortet mit **HTTP 402**. Eine freie Alternative bräuchte einen FRED-Schlüssel — Nutzerentscheidung nach §95 |
| §29 | Zentralbanken: Zinsentscheidungen | `DONE` | Aus dem Leitzinspfad abgeleitet, 2-Jahres-Fenster. Live: 9 Entscheidungen seit 2024-09. `policy-rate-history.ts`, 13 Tests |
| §29 | Zentralbanken: Sitzungstermine, Statements, Protokolle | `NOT STARTED` | Aus einem Zinspfad nicht ableitbar, braucht eine Terminquelle |
| §30 | Sentiment | `IN PROGRESS` | Teilweise über News |
| §31 | SEC-Filings mit Originallink | `DONE` | `sec/edgar.ts` + `GET /api/sec/filings`. EDGAR ist **kostenlos und die Primärquelle**. Gemessen an Apple: 1000 Filings, davon 587 Form 4, 105 8-K, 34 10-Q. 13 Tests |
| §32 | Insidertransaktionen | `DONE` | `sec/form4.ts` **auf der Seite**: Person, Position, Stückzahl, Preis, Wert und die Unterscheidung echter Käufe von Vergütung, Optionsausübung und 10b5-1-Plänen. Jede Zeile trägt ihren Transaktionscode. 25 Tests |
| §33 | Analystenurteile | `DONE` | Buy/Hold/Sell und Kursziele nach Zeitraum getrennt, dazu die **zeitliche Veränderung als Darstellung**: gemeinsame Skala mit dem aktuellen Kurs als Bezugslinie. Live: AAPL 111 Urteile, Ziel 1M 329,55 $ gegen 1J 306,68 $ |
| §34 | Short Interest | `BLOCKED` | `short-interest` gibt HTTP 404 — nicht im Tarif |
| §35 | Optionen | `BLOCKED` | `options-chain` gibt HTTP 404 — nicht im Tarif |
| §36 | Peer-Analyse | `DONE` | Vergleich über KGV, KUV, Brutto- und Nettomarge, Verschuldung und **ROIC** gegen den Median der Gruppe. Live an AAPL gegen fünf Wettbewerber. Offen: Wachstum, Performance und Analystenerwartungen als Vergleichsachsen |
| §37 | Bewertungsmodelle DCF/Multiples | `IN PROGRESS` | `analysis/valuation.ts`: DCF, Reverse DCF, Sensitivität, Gewinn- und FCF-Rendite, Peer-Median. 31 Tests, fünf Regressionen gegengeprüft. Offen: Anbindung an die Oberfläche und historische Bewertung |
| §38 | Szenarien mit Bandbreiten | `VERIFIED` | `forecast-passport.ts`, keine Punktziele |
| §39 | Forecast-Transparenz | `VERIFIED` | Ledger mit Cutoff, Modellversion, Input-Digest |
| §40 | Risikoanalyse | `DONE` | `risk-engine.ts`, getestet |
| §60 | Finanzmathematik geprüft | `IN PROGRESS` | Kernfunktionen getestet, keine vollständige Revision |
| §70–§74 | Change Detection, Anomalien, Regime, Benchmarking | `NOT STARTED` | — |
| §101 | Kein LLM als Prognosemotor | `VERIFIED` | Deterministisch |

### §26: die drei Erfindungsquellen und was aus ihnen wurde

Beim Anschließen zeigte sich, dass es nicht eine Stelle war, sondern drei — und
dass keine davon den Indikator berechnete, dessen Namen sie trug.

| Ort | Was dort stand | Warum das falsch war | Jetzt |
|---|---|---|---|
| `chart-data.ts` | `rsi = 30 + Anteil grüner Kerzen × 45` | Konstruktionsbedingt zwischen 30 und 75 — konnte **nie** überkauft oder überverkauft melden | `computeIndicators` |
| `chart-data.ts` | `ma200` mit `Math.max(1, slice.length)` als Teiler | Bei 60 Kerzen der Schnitt aus 60 Werten, ausgegeben als „MA 200". Die gefährlichste Zeile, weil das Ergebnis plausibel aussah | `null`, wenn die Reihe kürzer als 200 ist |
| `chart-data.ts` | Bollinger als feste ±3,5 % | Ohne Standardabweichung ist es kein Bollinger-Band | Aus der gemessenen Streuung |
| `market-provider.ts` | `rsi` aus der Tagesveränderung, `macd = Kurs × 0,004` | Ein zum Kursniveau proportionaler MACD sagt über Momentum nichts | `NO_INDICATORS` — aus einem einzelnen Kurs gibt es keine Indikatoren |
| `mock/market.ts` | `rsi = 50 + bias × 38` aus einem Score-Seed | Der RSI folgte dem Score statt umgekehrt | Gerechnet über die Mock-Kerzen |

**Die Folgewirkung war der eigentliche Schaden.** `risk-engine.ts` erzeugte aus
dem erfundenen RSI einen Befund mit `evidence: "RSI 74"` — eine erfundene Zahl,
die als Beleg auftrat. Und `support` war `Kurs × 0,96`, weshalb der Befund
„Support gebrochen" nie auslösen konnte: eine Fassade nach §90. Beide Stellen
sind jetzt an echte Werte gebunden und prüfen auf Lücken.

**Gegengeprüft**, indem jede der vier Formeln absichtlich wieder eingesetzt
wurde — jede wurde von einem eigenen Test rot gemeldet.

### §61: die erzeugten Kerzen sind ersetzt, nicht nur entschärft

Zwei Stellen erzeugten Kursverläufe, die es nie gab:

| Ort | Formel | Wirkung |
|---|---|---|
| `market-provider.ts` `candlesFromQuote` | `close = Kurs − Bewegung × (1 − Fortschritt) + sin(index × 0,7) × Vola × 0,08` | 32 Kerzen je Zeitfenster aus **einem** Kurs. Die Risiko-Engine las daraus Momentum und Volumentrend und erzeugte Befunde mit Belegen |
| `chart-data.ts` `fallbackCandles` | `close = base + drift × index + sin(index × 0,71) × Vola × 0,24` | Ein **gezeichnetes Kursdiagramm** eines Verlaufs, den es nicht gab — die sichtbarste Form von §61, und nichts an der Darstellung verriet es |

Beide sind gelöscht. An ihre Stelle tritt `providers/price-history.ts` mit
echter Tageshistorie.

**Gemessen am 2026-08-08** gegen die Produktions-API: FMP liefert im vorhandenen
Tarif 1255 Tageskerzen für AAPL (2021-08-09 bis 2026-08-07) und 1826 für
BTCUSD. Für ETFs antwortet dieselbe Route mit HTTP 402 — Tarifgrenze, kein
Fehler, und sie wird als solche benannt. Finnhub-Kerzen sind mit HTTP 403
gesperrt, es gibt für die Historie also **kein Failover**.

Die Probe an echten AAPL-Daten ergab ein in sich stimmiges Bild:

```
RSI 14: 47,58   SMA 20/50/200: 323,43 / 309,79 / 279,41
MACD 0,878 | Signal 4,059 | Histogramm −3,181
Bollinger 301,42 .. 345,45   Unterstützung/Widerstand 300,00 / 344,57
Fenster: 1D=0  5D=5  1M=23  3M=63  6M=126  YTD=150  1Y=252  5Y=1255
```

Der Kurs von 313,33 liegt unter dem SMA 20 bei aufsteigender
Durchschnittsstruktur — dazu passen der neutrale RSI und das negative
Histogramm. `1Y=252` ist genau die Zahl der Handelstage eines Jahres.

**`1D` bleibt leer.** Tagesschlusskurse enthalten keinen Intraday-Verlauf. Die
Oberfläche zeigt dort eine Begründung statt einer Kurve.

**Das Fehlen ist selbst ein Befund.** `risk-engine.ts` meldet unter 16 Kerzen
„Keine belastbare Kurshistorie" und unterdrückt Trend- und Volumenaussagen —
sonst sähe ein Instrument ohne Daten aus wie eines ohne Risiken.

Gegengeprüft mit vier absichtlich wieder eingesetzten Fehlern (Reihenfolge
nicht umgedreht, Tagesfenster erfunden, unbrauchbare Zeilen aufgefüllt,
Historie-Schranke entfernt) — jeder wurde rot gemeldet.

### §26: ADX, Trendkanal, Ausbruch, Mehrzeitrahmen

Die vier Punkte, die über die Standardindikatoren hinausgehen. Bei jedem war
die Frage nicht die Formel, sondern die Stelle, an der ein Modell sich selbst
überschätzt:

| Punkt | Die Falle | Was dagegen gebaut ist |
|---|---|---|
| **ADX** | Ein hoher ADX wird als „steigend" gelesen. Er misst nur **Stärke**, nicht Richtung | +DI und −DI stehen immer daneben; ein Test verlangt, dass Auf- und Abwärtstrend **ähnlich hohe** Werte liefern |
| **Trendkanal** | Eine Regressionsgerade durch reines Rauschen hat ebenfalls eine Steigung | `fit` (Bestimmtheitsmaß) ist Pflichtfeld und wird angezeigt; unter 0,5 heißt der Kanal ausdrücklich nicht belastbar |
| **Ausbruch** | Jedes neue Tageshoch als „Ausbruch" zu melden | Mindeststärke von 0,25 ATR; Stärke in ATR statt Prozent, damit ruhige und volatile Werte vergleichbar sind. Volumenbestätigung getrennt ausgewiesen |
| **Mehrzeitrahmen** | Drei Fenster zu einer Mehrheitsmeinung verrechnen | `mixed` ist ein eigener Zustand. Zwei gegen einen ergibt **keine** Aussage — das wäre erfundene Eindeutigkeit |

Zwei Unterscheidungen sind bewusst und werden von Tests gehalten:

- **`null` ≠ `{ status: "none" }`** beim Ausbruch: „lässt sich nicht sagen"
  gegen „kein Ausbruch". Beides in `null` zusammenzufassen wäre die Sorte
  Unschärfe, die später als Aussage gelesen wird.
- **Ein Fenster ohne Daten zählt nicht als neutral**, sondern gar nicht. Sonst
  würde fehlende Historie zu einer Stimme.

**Probe an echten AAPL-Daten** (2026-08-08) — und das Ergebnis begründet den
Aufwand:

```
ADX 14: 23,6   +DI 24,5   −DI 28,7        → knapp unter 25: richtungslos
Trendkanal: aufwärts, +8,4 %, Güte 27 %   → NICHT belastbar
Ausbruch: keiner
Kurzfristig (1M):   23 Kerzen, seitwärts, −1,7 %, Güte  2 %
Mittelfristig (3M): 63 Kerzen, aufwärts,  +8,9 %, Güte 30 %
Langfristig (1J):  252 Kerzen, aufwärts, +26,5 %, Güte 65 %
→ mixed
```

Eine Einzelansicht hätte „Aufwärtstrend" gemeldet. Tatsächlich ist der
kurzfristige Verlauf mit 2 % Güte reines Rauschen, und nur die Jahressicht
beschreibt überhaupt eine Gerade. Genau dieser Fall ist der Grund, warum §26
mehrere Zeitrahmen verlangt.

**Einschränkung, ehrlich benannt:** alles läuft auf Tagesbasis. Intraday-
Zeitrahmen gibt es nicht, weil der Anbietertarif keine Intraday-Historie
enthält — nicht, weil die Rechnung sie nicht könnte.

### §27: Einordnung, Ereignisse, Duplikate

Vor dieser Arbeit war die `relevance` erfunden — und zwar auf eine Weise, die
schwerer zu bemerken war als der RSI:

```
Marketaux:  relevance = 74 + |sentiment| × 22 − index × 2
NewsAPI:    relevance = 82 − index × 3
```

**Die Position in der Antwort war der Messwert.** Der zweite Treffer war immer
relevanter als der dritte, unabhängig vom Inhalt. Zugleich lieferte Marketaux
mit `match_score`, `industry` und `country` genau die Angaben, die §27 verlangt
— und der Code warf sie weg und behielt nur `entities[0].symbol`.

Jetzt: `match_score` als Relevanz (am 2026-08-08 gemessen: 6 bis 51, das Feld
`relevance_score` ist im Tarif durchgehend `null`). Bei NewsAPI bleibt die
Relevanz `null` — die Antwortreihenfolge ist keine Messung.

**Jede Einordnung trägt ihren Beleg.** §104 verbietet die Black Box, deshalb ist
`matchedText` Pflichtfeld: „Übernahme" erscheint mit dem Wortlaut „acquires",
der sie ausgelöst hat. Wer den Fehlschluss sieht, kann ihn erkennen.

Der Klassifikator ist nach der Gegenrichtung gebaut — nicht was er findet,
sondern was er **nicht** finden darf:

| Text | Darf nicht heißen |
|---|---|
| „dividend yield of 3.4 %" | Dividendenänderung |
| „software upgrade" | Analystenänderung |
| „customer acquisition costs" | Übernahme |
| „merger arbitrage fund" | Fusion |
| „ahead of its earnings" | Quartalszahlen |
| „expected to launch" | Produkteinführung |

Ohne Treffer bleibt die Liste leer. Eine Auffangkategorie „Sonstiges" sähe aus
wie eine Einordnung und wäre keine.

**Bei der Entdopplung ist der zweite Fehler der schlimmere.** Ein doppelter
Eintrag ist lästig; eine verschluckte Gewinnwarnung ist gefährlich. Der
kalibrierende Fall: „Apple **beats** Q3 estimates" gegen „Apple **misses** Q3
estimates" — ein Wort Unterschied, gegenteilige Bedeutung, dürfen nie
zusammenfallen. Sie liegen bei 0,56 und damit unter der Schwelle von 0,6.

**Vier eigene Fehler, von den eigenen Tests gefunden:**

1. Das Prognosemuster ließ nur einen Qualifizierer zu und übersah damit
   „raises **its full-year** guidance" — die häufigste Formulierung überhaupt.
2. Die deutsche Variante verlangte „Prognose angehoben" und scheiterte an
   „hebt Prognose an".
3. Ohne Stammformreduktion galten „acquires" und „acquire" als verschiedene
   Wörter. Ein eindeutiges Dublettenpaar kam deshalb nur auf 0,44.
4. Die Stoppwortliste war **zu** aggressiv: sie strich „report", „stock" und
   „market", worauf zwei völlig verschiedene Schlagzeilen auf denselben einen
   Rest schrumpften und zu 100 % ähnlich waren. Behoben durch Kürzen der Liste,
   Stammform **vor** dem Filter und eine Mindestzahl unterscheidender Wörter.

Bei der Gegenprobe blieb die Mindestwortzahl zunächst grün — sie war
ungeprüfter Code. Der fehlende Test ist nachgetragen.

**Live gemessen** an 9 echten Meldungen: Bezüge vollständig (11 Unternehmen,
11 Branchen, 9 Länder), eine Ereignisart erkannt („Q2 Earnings"). Dass nur eine
von neun eine Ereignisart hat, ist kein Fehler — die übrigen sind Analysen
(„Is It Time to Buy?"), keine Ereignismeldungen.

Aufschlussreich war ein Fehlgriff des **Anbieters**: eine Meldung über „Miami
International" wurde von Marketaux Microsoft zugeordnet. Sie trug den
niedrigsten `match_score` der Stichprobe (6 gegen 51 beim besten). Genau
deshalb werden Herkunft und Score mitgeführt statt weggeworfen.

### §28: elf Reihen statt fünf — und was nicht geht

Sechs EZB-Reihen ergänzt, jede einzeln gegen die Live-API geprüft:
Kerninflation, Arbeitslosenquote, BIP, Industrieproduktion,
Einzelhandelsumsätze, Geldmenge M3. Dazu fünf Marktindikatoren über den
Kursanbieter: Gold (4399,70), Brent (83,55), Silber, VIX (14,90), S&P 500.

Ein falscher Schlüsselversuch für die Arbeitslosenquote antwortete mit 404 und
steht **nicht** im Katalog — aufgenommen wird nur, was nachweislich liefert.

### §28: FRED schließt die US-Lücke — ohne Schlüssel

Die Annahme, FRED brauche einen Schlüssel, war falsch. Am 2026-08-08 gemessen:
der CSV-Export unter `fred.stlouisfed.org/graph/fredgraph.csv` antwortet **ohne
Authentifizierung**; nur die JSON-API unter `api.stlouisfed.org` verlangt einen
(HTTP 400 ohne). Damit entfällt die Nutzeraufgabe komplett.

Elf Reihen aufgenommen, jede einzeln geprüft — darunter genau die drei, die der
Kursanbieter mit HTTP 402 gesperrt hatte:

| Reihe | Stand |
|---|---|
| **WTI-Öl** `DCOILWTICO` | 81,96 (2026-08-03) |
| **Dollar-Index (breit)** `DTWEXBGS` | 119,70 (2026-07-31) |
| **10J-US-Rendite** `DGS10` | 4,69 (2026-08-06) |
| CPI / Kern-CPI / PPI | 332,57 / 336,07 / 286,83 |
| Arbeitslosenquote | 4,1 % (2026-07) |
| **NFP** `PAYEMS` | **−23** Tsd. (2026-07) |
| BIP-Wachstum | 1,5 % (Q2 2026) |
| Einzelhandel, Konsumentenvertrauen | 768.553 Mio. $ / 49,5 |

**Zwei Entwurfsentscheidungen, die die Live-Probe bestätigt hat:**

*Lücken werden verworfen, nicht gefüllt.* FRED lässt Zeilen ohne Beobachtung
leer oder setzt einen Punkt. Bei der 10J-Rendite sind das **719 von 16.853
Zeilen** (Wochenenden und Feiertage), beim Konsumentenvertrauen 210 von 884.
Wer interpoliert, erfindet 719 Anleiherenditen.

*NFP ist eine Veränderung, kein Bestand.* `PAYEMS` liefert 158.858 Tsd.
Beschäftigte. Die berichtete NFP-Zahl ist die Monatsdifferenz — im Juli 2026
**−23 Tsd.**, also ein Rückgang. Der Rohwert als „NFP" wäre um Faktor 6900 zu
groß und hätte das Vorzeichen verloren.

### Die Lizenzfrage — offen und juristisch

FRED unterscheidet drei Rechtsstände. Sie stehen **je Reihe gemessen** im
Katalog, nicht pauschal angenommen. Zehn Reihen sind *Public Domain: Citation
requested*, eine (Konsumentenvertrauen, Universität Michigan) ist *Copyrighted:
Citation required*. Reihen mit *Pre-approval required* sind **nicht**
aufgenommen — sie wären ohne schriftliche Erlaubnis nur nicht-kommerziell
nutzbar.

Abschnitt IV der FRED-Bedingungen erlaubt für beide aufgenommenen Stände
„internal commercial uses" und die Darstellung in „reports to clients" mit
Quellenangabe. Ob ein **kostenpflichtiges SaaS-Produkt** darunter fällt — oder
unter das Verbot, „datasets for commercial use" weiterzuverbreiten — ist eine
juristische Frage und keine technische.

**Sie gehört auf dieselbe Liste wie AGB und Widerrufsbelehrung: braucht einen
Anwalt, nicht mich.** Technisch ist alles vorbereitet: die Quellenangabe ist
Pflichtfeld an jeder Reihe, der Rechtsstand steht daneben, und ein Test hält
fest, dass keine genehmigungspflichtige Reihe im Katalog landet.

**Weiterhin nicht möglich:**

| Fehlend | Grund |
|---|---|
| PMI | `NAPM` gibt bei FRED HTTP 404 — das ISM hat die Weiterverbreitung eingestellt. `INDPRO` ist etwas anderes und steht nicht als Ersatz da |
| Economic Calendar | FMP-Route antwortet mit HTTP 402 |

Brent steht **nicht** als Ersatz für WTI — beide sind jetzt getrennt vorhanden
und laufen zeitweise deutlich auseinander (83,55 gegen 81,96).

Quartalsreihen haben eigene Altersschwellen bekommen: ein BIP-Wert liegt erst
rund zwei Monate nach Quartalsende vor, 150 Tage sind dort normal und kein
Ausfall.

### §29–§38: was erreichbar ist, gemessen am 2026-08-08

Zehn Abschnitte auf einmal. Statt zehn flacher Umsetzungen zuerst die Messung,
welche Quelle überhaupt antwortet:

| § | Quelle | Ergebnis |
|---|---|---|
| §29 Zentralbanken | Fed-RSS `press_monetary.xml` | **200**, 15 Einträge |
| §29 | EZB-RSS | 200, aber nur 1 Eintrag |
| §30 Fear & Greed (Aktien) | CNN | **418** — Bot-Erkennung |
| §30 Fear & Greed (Krypto) | alternative.me | **200**, frei |
| §30 VIX | FRED / FMP | **200** (beide) |
| §30 Put/Call, Reddit | — | keine freie Quelle |
| §31 Filings | **SEC EDGAR** | **200**, kostenlos, Primärquelle |
| §32 Insider | **SEC Form 4** | **200**, mit Transaktionscodes |
| §33 Analysten | FMP `grades-consensus` | **200** |
| §34 Short Interest | FMP | **404** |
| §35 Optionen | FMP | **404** |
| §36 Peers | FMP `stock-peers` | **200** |
| §37 Bewertung | FMP Abschlussdaten | **200** |
| §38 Szenarien | eigene Rechnung | bereits `VERIFIED` |

Umgesetzt ist zuerst §31 und §32, weil dort der Gewinn am größten ist: EDGAR
ist nicht die Auswertung eines Dritten, sondern das bei der Behörde
eingereichte Dokument. Besser als §91 (Herkunft sichtbar) es verlangt.

### §32: der Satz, der die Arbeit bestimmt hat

> „Unterscheide echte Open-Market-Käufe von Compensation, Optionsausübung,
> automatischen Verkaufsprogrammen."

Der bisherige Typ war `{ date, person, action: "Buy" | "Sell", value }` — er
**konnte** diese Unterscheidung nicht abbilden. Ein gemessenes Beispiel zeigt,
warum das mehr als ein Schönheitsfehler ist. Apple, 2026-06-15:

```
Newstead Jennifer, SVP, GC and Secretary
  Code M   +30.104 Aktien
  Code F   −16.238 Aktien zu 296,42 $
```

Ein naives Modell liest „30.104 Aktien erworben" und meldet einen Insiderkauf.
Tatsächlich hat niemand etwas gekauft: `M` ist die Ausübung zugeteilter
Optionen, `F` die sofortige Rückgabe von Anteilen zur Steuerzahlung.
**Ein echter Kauf ist Code `P`** — nur er bedeutet eigenes Geld zum Marktpreis.

Ein Test hält fest, dass ausschließlich `P` und `S` als Marktgeschäft gelten.
Wäre ein weiterer Code darunter, entstünde genau das Signal, das §32
ausschließen will.

### Ein eigener Fehler, den erst die Live-Daten aufgedeckt haben

Die Zusammenfassung meldete an echten Apple-Daten:

> „Alle Markttransaktionen stammen aus vorab festgelegten Plänen (Rule 10b5-1)."

Das war falsch. Ich hatte alle geplanten Vorgänge (6) mit der Zahl der
Markttransaktionen (6) verglichen — **ein Zahlenzufall.** Tatsächlich waren nur
3 der 6 Marktverkäufe geplant; die übrigen drei stammten von einem
Verwaltungsratsmitglied und summierten sich auf **86,7 Mio. $**.

Ein Zufall in zwei Zählern hätte damit die größte Position des Zeitraums
weginterpretiert. Behoben, mit einem Test, der genau diese Zahlengleichheit
nachstellt.

Nebenbei fiel auf: `officerTitle` ist nur bei Vorständen gefüllt. Genau dieser
Verkäufer hatte deshalb gar keine Position — obwohl seine Rolle gemeldet war.
`insiderRole()` nennt sie jetzt.

### §37: der DCF und seine gefährlichste Eigenschaft

Ein DCF erzeugt aus grob geschätzten Annahmen eine Zahl mit zwei
Nachkommastellen. **Das Ergebnis sieht genauer aus als jede einzelne Eingabe.**
§38 zieht daraus die Regel: Spanne statt Punktwert.

An echten Apple-Zahlen gerechnet (FCF 98,8 Mrd. $, 8 % Wachstum, 9 %
Diskontsatz, 2,5 % ewiges Wachstum):

```
Punktwert:                     182,10 $
Spanne aus 25 Kombinationen:  140–290 $
```

Ein Faktor von mehr als zwei — bei Veränderungen von ±2 Prozentpunkten beim
Diskontsatz und ±1 beim ewigen Wachstum. Wer den Punktwert zeigt, behauptet
eine Genauigkeit, die keine der Eingaben hat.

Drei Verweigerungen sind eingebaut, weil ein DDCF für fast jede Eingabe eine
Zahl liefert und die meisten davon Unsinn sind:

| Fall | Warum |
|---|---|
| Ewiges Wachstum ≥ Diskontsatz | Gordon teilt durch `(r − g)`. Ein Unternehmen, das dauerhaft schneller wächst als Kapital kostet, wäre irgendwann die gesamte Wirtschaft |
| Negativer freier Cashflow | Der DCF würde den Verlust fortschreiben |
| Weniger als drei Peers | Ein „Median" aus zwei Zahlen ist deren Mittelwert |

**Der Reverse DCF ist die ehrlichere Frage.** Statt eigene Annahmen zu setzen,
macht er sichtbar, was im Kurs schon steckt: Apple bei 313,33 $ setzt rund
**25,3 % jährliches FCF-Wachstum über fünf Jahre** voraus. Ob das plausibel
ist, ist eine Frage über das Unternehmen — nicht über das Modell.

Die Renditebetrachtung sagt dasselbe unabhängig: Gewinnrendite 2,9 % liegt
1,76 Prozentpunkte **unter** der risikofreien Verzinsung.

**Eine Schwelle wurde durch Messung korrigiert.** Der Hinweis „zu viel Wert aus
dem Endwert" stand zunächst bei 75 %. Gemessen liegen übliche Konfigurationen
zwischen 50 % und 81 % — der Hinweis hätte bei jeder zweiten Rechnung
angeschlagen und wäre überlesen worden. Jetzt bei 85 %; der Anteil selbst steht
unabhängig davon immer im Ergebnis.

**Ein eigener Fehler in der Probe, der ins Modul gehört.** Ich hatte die
Nettoverschuldung als `enterpriseValue − marketCap` abgeleitet und erhielt
707 Mrd. $ Nettoliquidität — um über eine Größenordnung zu hoch. Ursache: der
Unternehmenswert stammt aus dem Geschäftsjahr 2025, die Marktkapitalisierung
von heute. Genau das Vermischen von Stichtagen, das §22 verbietet und das die
Zinsstrukturbewertung bereits verweigert.

**Behoben und nachgemessen.** Die Nettoverschuldung kommt jetzt aus der Bilanz
(`balance-sheet-statement.netDebt`). Für AAPL sind das **76,4 Mrd. $ Schulden**
statt 707 Mrd. $ Liquidität — und das verschiebt die Bewertung erheblich:

| | mit falschem Wert | mit Bilanzwert |
|---|---|---|
| DCF-Punktwert | 182,10 $ | **128,77 $** |
| Spanne | 140–290 $ | **88–240 $** |
| Implizites Wachstum | 25,3 % | **30,3 %** |

Rund 30 % Unterschied im Ergebnis — aus einem einzigen falsch beschafften Feld.

## Produkt und Oberfläche

| § | Anforderung | Status | Beleg / offener Rest |
|---|---|---|---|
| §41–§43 | Watchlist, Alerts, Portfolio | `DONE` | Cloud-Sync mit lokalem Rückfall |
| §44 | Backtesting | `IN PROGRESS` | Oberfläche vorhanden, ohne Point-in-Time nicht belastbar |
| §45 | Mehrdimensionales Signalsystem | `DONE` | Keine simplen BUY/SELL-Ausgaben |
| §46 | Market Dashboard | `DONE` | — |
| §47 | Screener über Gesamtuniversum | `BLOCKED` | BLOCKER-005, `company-screener` = 402 |
| §48 | Globale Suche | `DONE` | `search/fuzzy.ts` **verdrahtet**: `market-universe.ts` nutzt sie statt `includes()`. „Mircosoft" findet Microsoft. Damerau-Levenshtein, ISIN mit Prüfziffernvalidierung, Akzente ignoriert. 28 Tests, vier Regressionen gegengeprüft |
| §50 | Kennzahlen mit Kontext | `IN PROGRESS` | `analysis/metric-context.ts` + `MetricWithContext`: 12 Kennzahlen mit Erklärung, Begründung, Vorbehalt und Fünfjahresvergleich. 18 Tests, zwei Regressionen gegengeprüft. Offen: Verdrahtung auf allen Seiten |
| §49 | Asset-Seiten | `DONE` | Reihenfolge nach §49: Chart von Platz **10 auf 2**, News vom **Ende auf 9**, Bewertung/Kennzahlen/Analysten/Peers auf 4–6, Insider und Filings auf 11–12, Szenarien zuletzt. Alle Abschnitte an echten Daten |
| §51 | Design | `IN PROGRESS` | Eigenständig, nicht systematisch geprüft |
| §52 | Mobile/PWA | `IN PROGRESS` | Manifest vorhanden, nie auf Geräten geprüft |
| §79 | i18n de/en | `NOT STARTED` | Oberfläche durchgängig deutsch |
| §81/§82/§83 | Export, Sharing, Workspaces | `NOT STARTED` | Nur DSGVO-Export |
| §102–§105 | Trading-Bot, Paper Trading, Strategy/Risk Engine | `NOT STARTED` | `risk-engine.ts` deckt Analyse ab, nicht Ausführung |

### §48 und §50: zwei Entwürfe, eine Regel

**§48 — ein falscher Treffer ist schlimmer als kein Treffer.**

Wer „Mircosoft" tippt, meint Microsoft. Wer „qqqwwweee" tippt, meint nichts —
und dann darf nicht das Ähnlichste erscheinen, weil der Nutzer sonst glaubt,
gefunden zu haben, was er suchte. Die Mindestähnlichkeit liegt bei 0,7, unter
vier Zeichen wird gar nicht unscharf gesucht.

Der Editierabstand ist **Damerau**-Levenshtein, nicht der einfache: der
Zahlendreher zählt als ein Schritt statt zwei. Das ist beim Tippen der
häufigste Fehler überhaupt.

**ISINs werden nie unscharf gesucht.** Eine um ein Zeichen abweichende ISIN ist
ein anderes Papier, kein ähnliches. Dafür wird die Prüfziffer validiert
(Buchstaben zu Zahlen, dann Luhn), und das entscheidet über die Auskunft:

| Eingabe | Antwort |
|---|---|
| `US0378331005` | Apple |
| `US0378331006` | „Ungültige Prüfziffer. Vermutlich ein Tippfehler" |
| `GB0002634946` | „Gültig aufgebaut, hier aber nicht hinterlegt" |

Der Unterschied entscheidet, wo der Nutzer weitersucht — bei sich oder bei uns.

**§50 — der Vergleich macht die Zahl erst verständlich.**

Der Anspruch steht wörtlich im Auftrag: nicht `P/E 42`, sondern
`P/E 42 – deutlich über dem 5-Jahres-Median`.

Gemessen am 2026-08-08: der Tarif liefert genau **fünf** Geschäftsjahre
(`limit=5` → 200, `limit=6` → HTTP 402). Das passt zufällig genau auf das
Fenster, das §50 nennt. Der Zeitraum wird trotzdem überall mit ausgegeben statt
angenommen — bei drei Jahren steht „3-Jahres-Median" da.

An echten AAPL-Daten:

```
KGV 34,1 — deutlich über dem 5-Jahres-Median von 27,8.   (+22,7 %)
```

Zwei Trennungen sind Absicht:

1. **Messung und Bewertung stehen nicht im selben Satz.** „Über dem Median" ist
   eine Messung. Ob das gut ist, hängt von der Kennzahl ab — bei der Marge ist
   „darüber" günstig, beim KGV nicht. Die Färbung übernimmt `bandTone()`, der
   Satz bleibt wertungsfrei.
2. **Der Vorbehalt ist Pflichtfeld.** Bei vielen Kennzahlen ist er der
   wichtigste Teil: ein hohes KGV heißt nicht „teuer", sondern „der Markt
   erwartet Wachstum". Der ADX sagt gar nichts über die Richtung.

**Eine Lücke, die die Daten selbst zeigten:** bei AAPL steht die
Eigenkapitalrendite in allen fünf Jahren auf `0,00`. Das ist ein leeres
Anbieterfeld, keine Messung — eine Rendite von 0 % wäre eine Aussage. Eine
Reihe aus lauter Nullen gilt deshalb als Lücke.

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

# AGENTS.md — Arbeitsanweisungen für dieses Repository

StockPilot AI / STAI. Next.js 16, React 19, TypeScript strict, Supabase, Stripe,
Capacitor/iOS. Mobile-first PWA für Multi-Asset-Research.

Dieses Dokument hält fest, was **gemessen** wurde, damit es niemand erneut
herleiten muss, und welche Entscheidungen bewusst so getroffen sind.

Stand: 2026-08-07

---

## 1. Die drei Dinge, die du zuerst wissen musst

### 1.1 Der FMP-Tarif ist die Produktgrenze, nicht der Code

Gemessen am 2026-08-07 gegen die Live-API mit dem konfigurierten Schlüssel:

| Endpunkt | HTTP | Bedeutung |
|---|---|---|
| `v3/stock/list`, `v3/etf/list`, `v3/available-traded/list` | 403 | Legacy, von FMP abgeschaltet |
| `v3/symbol/available-*` | 403 | Legacy, abgeschaltet |
| `stable/company-screener` | 402 | nicht im Tarif |
| `stable/available-exchanges` | 402 | nicht im Tarif |
| `stable/search-isin` | 402 | nicht im Tarif |
| `stable/search-symbol`, `stable/search-name` | 200 | nutzbar |
| `stable/quote` | 200 | **aber symbolweise gated** |

**Kursabruf ist nicht vorhersagbar.** AAPL 200, BTCS 402. SPY 200, QQQ 402.
Gleiche Assetklasse, gleicher Handelsplatz. FMP schaltet einzelne Symbole frei.

→ **Baue keine Heuristik für Kursverfügbarkeit.** Sie wäre nachweislich falsch.
Der Status wird gemessen und in `instruments.quote_status` gespeichert.

→ **Behaupte niemals ein vollständiges Instrumentuniversum.** Das Universum
wächst suchgetrieben. `coverage.complete` ist `false` und bleibt es, bis ein
Verzeichnis-Sync nachweislich gelaufen ist.

Details und Aktivierungsschritte: `docs/BLOCKERS.md`.

### 1.2 Mandantentrennung läuft über RLS, nicht über Anwendungscode

`getSupabaseAuth()` in `src/lib/supabase/user-data.ts` liefert **zwei** Clients:

- `auth.supabase` — an das Access Token gebunden, RLS greift. **Standard für
  alle Nutzerdaten.**
- `auth.serviceSupabase` — Service Role, umgeht RLS vollständig.

`serviceSupabase` ist auf genau drei Pfaden erlaubt, alle drei begründet:

1. `apply_portfolio_trade` — die RPC ist ausschließlich `service_role` gewährt.
2. DSGVO-Export — liest `billing_events`, das `authenticated` per Policy alles
   verweigert.
3. Admin-Kontolöschung — `auth.admin.*` gibt es nur mit Service Role.

→ **Erweitere diese Liste nicht ohne zwingenden Grund.** Jeder weitere Pfad
verlagert Mandantentrennung zurück in den Anwendungscode.

→ Es gibt **keinen** stillen Rückfall auf Service Role, wenn der Nutzer-Client
nicht gebaut werden kann. Das wäre exakt die Aufhebung der Trennung.

### 1.3 Das Mock-Universum umfasst 7 Symbole

`AAPL`, `MSFT`, `NVDA`, `VOO`, `BTC-USD`, `ETH-USD`, `PORTFOLIO`.

`MarketDataProvider.getAsset()` fragt **zuerst** den Mock, dann den echten Kurs.
Das heißt: für diese sieben Symbole sind Fundamentaldaten und News Mock-Daten,
auch wenn der Kurs echt ist. `assessDataQuality()` erkennt das und setzt
`sufficientForAnalysis` entsprechend herab — verlasse dich darauf, entferne es
nicht.

---

## 2. Nicht verhandelbar

1. **Keine erfundenen Marktdaten in Produktion.** Kein stiller Mock-Fallback,
   keine geschätzten Kennzahlen, keine erfundenen Quellen.
2. **Keine falsche Echtzeitbehauptung.** Der aktive Tarif liefert `delayed`.
   Zeige nie „Live".
3. **Keine garantierten Prognosen.** Wahrscheinlichkeiten, Bandbreiten,
   Szenarien — nie Punktprognosen als Wahrheit.
4. **Kein LLM als Rechenmaschine.** Kennzahlen, Indikatoren, Bewertungen und
   Risikomaße kommen aus deterministischem, getestetem Code.
5. **Keine Schein-Fertigstellung.** Ein Interface, TODO oder statisches JSON ist
   keine Funktion. Melde nie etwas als fertig, was es nicht ist.
6. **Keine Tests als bestanden melden, die nicht gelaufen sind.**

---

## 3. Architektur

```
src/app/            24 Seiten, 32 API-Routen
src/lib/            Domänenlogik
  providers/        Provider-Adapter (FMP, Finnhub, Alpha Vantage, …)
  intelligence/     News- und Event-Verarbeitung
  supabase/         Auth und Nutzerdaten
  billing/          Stripe und Entitlements
  institutional/    Governance, Lineage, Data Quality
src/components/     40 Komponenten, 33 davon Client
supabase/migrations 13 Migrationen, alle auf Produktion angewendet
```

### Konventionen, die du einhalten sollst

- **Reine Domänenlogik ohne I/O trennen.** Beispiel: `instrument-identity.ts`
  (rein) neben `instrument-master-store.ts` (Persistenz). Das ist nicht nur
  Stilfrage — Module mit `server-only` oder Supabase-Import sind unter Vitest
  in manchen Umgebungen nicht ladbar.
- **`server-only`** auf jedem Modul, das Secrets liest oder Service Role nutzt.
- **Provenance ist Pflicht.** Jeder Datenpunkt trägt Quelle, Zeitpunkt und
  Qualitätsstatus bis in die UI. Siehe `asset-provenance.ts`,
  `data-quality.ts`.
- **Rate Limiting auf jeder API-Route** über `rateLimit()` aus `api-guard.ts`.
  Einzige Ausnahme: der Stripe-Webhook (korrekt so).
- **Provider-Fetches nur über `fetchBoundedProviderJson`** — enthält
  SSRF-Allowlist, HTTPS-Zwang, Größen- und Timeout-Begrenzung.

---

## 4. Datenbank

Alle 13 Migrationen sind auf dem Produktionsprojekt `STAI` angewendet.
Supabase Security Advisor: null Findings. RLS auf allen Tabellen aktiv.

### Instrument Master

- `instruments` — kanonische ID `assetClass:exchange:symbol:currency`.
  Mehrfachlistings bleiben getrennte Zeilen (AAPL/NASDAQ ≠ AAPL.DE/XETRA).
- `instrument_identifiers` — Ticker, Provider-Symbol, Börse. **Keine ISIN**, der
  Tarif liefert keine.
- `upsert_instrument` — idempotent. Ein erneuter Treffer erhöht
  `confirmation_count` und kann die Konfidenz anheben, setzt aber nie
  `first_seen_at` zurück.
- `record_instrument_quote_status` — schreibt gemessene Kursverfügbarkeit.

Schreiben auf `instruments` ist server-only. `authenticated` hat Leserecht.

### Nutzerdaten

`profiles`, `watchlists`, `alert_rules`, `portfolios`, `portfolio_positions`,
`portfolio_transactions`, `alert_events`, `portfolio_snapshots`,
`analysis_snapshots`, `notifications`, `entitlements` — alle mit
`auth.uid() = user_id` Policies für SELECT/INSERT/UPDATE/DELETE.

Server-only (Policy verweigert `authenticated` alles): `billing_events`,
`forecasts`, `forecast_outcomes`, `model_registry`, `model_evaluations`, alle
`intelligence_*`-Tabellen.

---

## 4a. Der Prognosekreislauf

Drei Cron-Jobs in `vercel.json`, in dieser Reihenfolge sinnvoll:

| Zeit | Route | Zweck |
|---|---|---|
| 08:00 täglich | `/api/forecasts/generate` | Prognosen erzeugen und in den Ledger schreiben |
| 07:30 täglich | `/api/forecasts/evaluate` | Fällige Prognosen gegen den echten Kurs auswerten |
| — | `/track-record` | Öffentliche Trefferbilanz |

Alle brauchen `CRON_SECRET` beziehungsweise `STOCKPILOT_CRON_SECRET`.
Ohne Secret antworten die Jobs mit 503 und tun nichts — bewusst fail-closed.

**Vercel-Tarifgrenze beachten.** Auf dem Hobby-Tarif darf ein Cron nur **einmal
pro Tag** laufen; ein häufigerer Ausdruck lässt das Deployment fehlschlagen.
Deshalb steht in `vercel.json` überall ein simples tägliches Muster. Die
Wochentagsentscheidung liegt in `forecast-schedule.ts` — im Code, wo sie
testbar ist, statt im Cron-Ausdruck, wo sie ein Deployment-Risiko wäre.

Ebenfalls Hobby: Vercel ruft den Job irgendwann innerhalb der angegebenen
Stunde auf. Eine im Ausdruck kodierte Reihenfolge zwischen den Jobs ist dort
nicht garantiert — alle Jobs sind deshalb idempotent gebaut.

**Warum planmäßig erzeugt wird:** Ohne Job entstehen Prognosen nur, wenn jemand
zufällig eine Detailseite aufruft. Das Modell würde sich dann nur an den
Instrumenten messen, die gerade jemand angesehen hat — ein klassischer
Selection Bias.

**Auswahlregel:** Nur Instrumente mit `quote_status = 'available'`. Ein
Instrument ohne belegbaren Kurs bekommt keine Prognose, sonst entstehen
Ledger-Einträge, die zwangsläufig als `insufficient_data` enden und die
Bewertungsquote drücken.

`VERIFIED_BOOTSTRAP_SYMBOLS` in `forecast-coverage.ts` greift nur, solange der
Instrument Master leer ist. Diese sieben Symbole wurden einzeln gegen
`stable/quote` geprüft. Sie sind **kein Universum** — sobald der Master gefüllt
ist, greift die Liste nicht mehr.

## 5. Verifikation

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --max-warnings=0
npm test              # vitest, aktuell 47 Dateien / 257 Tests
npm run test:coverage # Schwellen in vitest.config.ts sind NICHT kalibriert
npm run build
npm run test:db       # braucht lokale Supabase-Instanz
```

**Wichtig zur Coverage:** `vitest.config.ts` hat `all: true`. Ohne diese Option
zählte v8 nur von Tests importierte Dateien — 26 von rund 200 — und meldete
88 % für etwa 5 % der Codebasis. Die Schwellen stehen bewusst tief
(10/35/15/10) und sind **noch nicht kalibriert**. Wer als Erster
`npm run test:coverage` erfolgreich ausführt: echten Wert ablesen und die
Schwellen dicht darunter setzen.

**Zum Build:** `next build` holt zur Buildzeit Live-Daten von den Providern und
läuft dadurch in „Collecting page data" lange. Das ist ein bekannter Zustand,
kein Hänger.

---

## 6. Was du nicht noch einmal machen musst

- FMP-Endpunkte durchprobieren. Die Messtabelle steht oben und in
  `docs/BLOCKERS.md`.
- Prüfen, ob RLS greift. Am 2026-08-07 direkt gegen Produktion getestet:
  Fremdzeilen unsichtbar, server-only Tabellen für `authenticated` gesperrt,
  Insert auf fremde `user_id` blockiert.
- Nach einem Verzeichnis-Endpunkt bei FMP suchen. Es gibt in diesem Tarif keinen.
- Eine Regel für Kursverfügbarkeit ableiten. Es gibt keine.

---

## 7. Arbeitsweise

- Prüfe den echten Repository-Stand, bevor du etwas annimmst.
- Miss, statt zu raten — besonders bei Provider-Verhalten.
- Führe nach jeder relevanten Änderung `typecheck`, `lint` und `test` aus.
- Halte `STATUS.md` nach jedem Meilenstein aktuell.
- Trage externe Blocker mit Nachweis und Aktivierungsschritten in
  `docs/BLOCKERS.md` ein.
- Committe getrennte, nachvollziehbare Meilensteine.
- Zerstöre keine funktionierenden Bestandteile für eine Umstrukturierung ohne
  belegte Notwendigkeit und ADR.
- Wenn ein externer Blocker auftaucht: dokumentiere ihn, implementiere
  Interface, Schema, UI, Fehlerzustand und Tests trotzdem vollständig weiter.

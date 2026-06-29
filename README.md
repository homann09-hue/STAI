# StockPilot AI

Mobile-first PWA für Aktien-, ETF- und Krypto-Analyse. Die App kombiniert Watchlist, Marktüberblick, Charts, technische Indikatoren, Fundamentaldaten, News, Alerts, Portfolio-Risiko, Datenqualität, Risiko-Engine und modellbasierte KI-Einschätzungen.

Wichtig: Keine Anlageberatung. Alle Analysen sind algorithmische Einschätzungen und können falsch sein. Investieren ist mit Risiko verbunden.

## Stack

- Next.js App Router, React, TypeScript
- TailwindCSS
- PWA mit `public/sw.js`, Manifest und Offline-Fallback
- Supabase vorbereitet für Auth, Watchlists, Alerts, Portfolio und Analyse-Snapshots
- Mock-Provider für Kurse, News, Fundamentals und KI-Analyse

## Setup

```bash
npm install
npm run dev
```

Die App läuft lokal unter `http://localhost:3000`.

## Prüfskripte

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:e2e:deep
npm run test:load
npm run qa:grammar
npm run qa:redteam
npm run audit:safe
```

`npm run audit:safe` bricht erst bei hohen oder kritischen Findings ab. Moderate Findings werden im Security Report dokumentiert und nicht mit `--force` automatisch aufgelöst.
`npm run qa:redteam` bündelt Typecheck, Lint, Unit-Tests, Production-Build, Browser-E2E, Lasttest, Sprachprüfung und den sicheren Audit.

## ENV

Kopiere `.env.example` nach `.env.local` und fülle bei Bedarf:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STOCKPILOT_MARKET_PROVIDER=mock
STOCKPILOT_QUOTE_PROVIDER=mock
STOCKPILOT_NEWS_PROVIDER=mock
STOCKPILOT_FUNDAMENTALS_PROVIDER=mock
STOCKPILOT_AI_PROVIDER=mock
FINNHUB_DATA_QUALITY=near_realtime
FINNHUB_STREAM_ENABLED=false
TWELVE_DATA_QUALITY=near_realtime
EODHD_DATA_QUALITY=delayed
MASSIVE_DATA_QUALITY=delayed

FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
POLYGON_API_KEY=
MASSIVE_API_KEY=
TWELVE_DATA_API_KEY=
YAHOO_FINANCE_API_KEY=
NEWS_API_KEY=
EODHD_API_KEY=
DATABENTO_API_KEY=
OPENAI_API_KEY=
```

## Architektur

- `src/app/page.tsx`: Dashboard mit Watchlist, Gewinnern, Verlierern, Marktüberblick, Trends, News und KI-Marktsentiment.
- `src/app/assets/[symbol]/page.tsx`: Detailseite mit Kurs, Line-Chart, Candlesticks, Volumen, Indikatoren, Fundamentals, News, Analysten, Insider, Earnings und KI-Cases.
- `src/app/learn/page.tsx`: Lernbereich für Anfänger mit Glossar, Risiko-Grundlagen und Beispiel-Portfolios.
- `src/app/portfolio/page.tsx`: Portfolio mit lokalen Kauf-Eingaben, Durchschnittskurs, P/L, Gewichtung und Risiko.
- `src/app/alerts/page.tsx`: Kurs-, RSI-, News-, Volumen-, Earnings- und KI-Risikoalarme.
- `src/app/pricing/page.tsx`: vorbereitete Feature-Gates für Free, Starter, Pro und Elite/Business.
- `src/app/settings/page.tsx`: Einstellungen mit Zielgruppen-Modus für Anfänger, Fortgeschrittene und Profis.
- `src/app/api/*`: API-Fassade für spätere echte Anbieter.
- `src/lib/providers/*`: austauschbare Provider-Interfaces.
- `src/app/api/market/quotes/route.ts`: normalisierte Batch-Quotes für sichtbare Symbole mit TTL-Cache.
- `src/app/api/market/stream/route.ts`: serverseitiger Marktdaten-Stream ohne API-Keys im Frontend, inklusive Heartbeat und Polling-Fallback.
- `src/lib/mock/market.ts`: Mock-Daten für MVP und Offline-Demo.
- `src/lib/data-quality.ts`: Datenvalidierung, Quellenranking, Aktualität, Mock-Kennzeichnung und Warnungen.
- `src/lib/risk-engine.ts`: Warnsystem für Volatilität, Liquidität, News, Earnings, technische Risiken, Makro-/Sektorrisiken und Datenqualität.
- `src/lib/scoring.ts`: transparentes Chancen-/Risiko-Scoremodell und modellbasierte Wahrscheinlichkeiten.
- `src/lib/portfolio-analytics.ts`: Portfolio-Gewichtung, Diversifikation, Szenarioanalyse und Klumpenrisiko.
- `src/lib/api-guard.ts`: Rate Limit, sichere JSON-Fehler, Security Header und Body-Parsing.
- `src/lib/supabase/*`: Supabase-Clients für Browser und serverseitige Service-Aufgaben.
- `supabase/schema.sql`: Tabellen und RLS-Policies für Nutzerprofile, Watchlists, Alerts, Portfolio und Analyse-Snapshots.

## API-Anbieter und echte Marktdaten

Die Provider-Schicht trennt Realtime, Near-Realtime, Delayed, Historical, Fundamentals, News und KI. Mock-Daten werden immer sichtbar als Mock markiert und dürfen nicht als echte Marktdaten interpretiert werden.

Aktuell vorbereitet:

- `mock`: Demo- und Offline-Daten, immer sichtbar als Mock markiert.
- `finnhub`: REST-Quote-Adapter plus optionaler providerseitiger WebSocket-Stream mit `FINNHUB_STREAM_ENABLED=true`.
- `twelve_data`: REST-Quote-Adapter für Aktien, ETFs, Krypto und Forex-Symbole.
- `eodhd`: Real-Time/Delayed-Quote-Adapter, Qualität abhängig vom gebuchten Plan.
- `massive`/`polygon`: Snapshot-Adapter für US-Aktien/ETFs, optional mit `MASSIVE_SNAPSHOT_URL`.
- `alpha_vantage`: nur Fallback, nicht als professioneller Hauptfeed.
- `databento`: reserviert für professionelle Tick-/Historical-Integration.

Yahoo oder inoffizielle Quellen sind bewusst nicht als professionelle Hauptquelle vorgesehen.

Jeder Kurs führt `provider`, `quality`, `marketStatus`, `timestamp`, `latencyMs`, `bid`, `ask`, `spread`, `high`, `low`, `open`, `previousClose` und `volume`, soweit der Anbieter diese Felder liefert.

Für echte Daten kann je Provider eine Klasse ergänzt werden:

- Kurse, Candles und Stream: Finnhub, Twelve Data, EODHD, Polygon/Massive, Databento
- News: NewsAPI, Finnhub News, Polygon News
- Fundamentals: Finnhub, Alpha Vantage, Polygon.io
- KI-Analyse: OpenAI oder ein eigener interner Analyse-Service

Beispiel:

```ts
class FinnhubMarketDataProvider implements MarketDataProvider {
  async getDashboard() {
    // Finnhub/Polygon/Twelve Data abrufen und in DashboardData mappen
  }

  async getAsset(symbol: string) {
    // Quote, Candles, Fundamentals, News und Scores in AssetDetail mappen
  }
}
```

Danach in `getMarketDataProvider()` anhand von `STOCKPILOT_MARKET_PROVIDER=finnhub` umschalten.

## PWA / Offline

Der Service Worker cached:

- App-Shell und Offline-Seite
- GET-Antworten unter `/api/*`
- statische Assets

Zusätzlich speichern Dashboard, Watchlist, letzte KI-Analysen, Alerts und Portfolio lokale Snapshots in `localStorage`, damit mobile Nutzer bei schlechter Verbindung weiterarbeiten können.

## Risiko- und Datenqualitätslogik

Jede Detailanalyse zeigt:

- Handlungseinordnung: Beobachten, Vorsicht, Interessant oder Hohes Risiko.
- Datenqualität inklusive Quellenranking, Zeitstempel, Mock-Kennzeichnung und Warnungen.
- Multi-Layer-Analyse für Markttrend, Sektortrend, Sentiment, Volatilität und Makro-Faktoren.
- Risiko-Engine mit konkretem Beleg und Prüfhinweis je Warnung.
- Professional Scores: Technical, Fundamental, News, Sentiment, Momentum, Volatility Risk, Liquidity Risk, Event Risk, Gesamt-Chancen-Score und Gesamt-Risiko-Score.
- Modellbasierte Wahrscheinlichkeiten mit dem Hinweis: "Diese Wahrscheinlichkeit ist keine Garantie und kann falsch sein."

Wenn Datenqualität zu schwach ist, wird die Analyse als nicht belastbar markiert.

## GitHub und Vercel

Das Projekt ist für ein eigenes GitHub-Repository und ein eigenes Vercel-Projekt vorbereitet. BauPro oder andere Projekte dürfen dafür nicht verlinkt oder deployed werden.

- GitHub CI: `.github/workflows/ci.yml`
- Manueller Red-Team-Lauf: `.github/workflows/redteam.yml`
- Manueller Vercel-Deploy: `.github/workflows/vercel-manual.yml`
- Vercel-Projektconfig: `vercel.json`
- Deployment-Anleitung: [GitHub und Vercel Deployment](./docs/GITHUB_VERCEL_DEPLOYMENT.md)

Der Vercel-Workflow läuft bewusst nur manuell und nutzt StockPilot-spezifische Secrets mit `STOCKPILOT_`-Präfix.

## Supabase

1. Supabase-Projekt erstellen.
2. SQL aus `supabase/schema.sql` im SQL Editor ausführen.
3. `.env.local` mit Supabase URL und Keys befüllen.
4. Auth-UI und echte Persistenz können auf den vorhandenen Tabellen aufgebaut werden.

## Security, Red Team und Grenzen

- [Security Checklist](./docs/SECURITY_CHECKLIST.md)
- [Red-Team Report](./docs/RED_TEAM_REPORT.md)
- [Test Report](./docs/TEST_REPORT.md)
- [Known Limitations](./docs/LIMITATIONS.md)

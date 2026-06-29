# StockPilot AI

Mobile-first PWA fuer Aktien-, ETF- und Krypto-Analyse. Die App kombiniert Watchlist, Marktueberblick, Charts, technische Indikatoren, Fundamentaldaten, News, Alerts, Portfolio-Risiko, Datenqualitaet, Risiko-Engine und modellbasierte KI-Einschaetzungen.

Wichtig: Keine Anlageberatung. Alle Analysen sind algorithmische Einschaetzungen und koennen falsch sein. Investieren ist mit Risiko verbunden.

## Stack

- Next.js App Router, React, TypeScript
- TailwindCSS
- PWA mit `public/sw.js`, Manifest und Offline-Fallback
- Supabase vorbereitet fuer Auth, Watchlists, Alerts, Portfolio und Analyse-Snapshots
- Mock-Provider fuer Kurse, News, Fundamentals und KI-Analyse

## Setup

```bash
npm install
npm run dev
```

Die App laeuft lokal unter `http://localhost:3000`.

## Pruefskripte

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run audit:safe
```

`npm run audit:safe` bricht erst bei hohen oder kritischen Findings ab. Moderate Findings werden im Security Report dokumentiert und nicht mit `--force` automatisch aufgeloest.

## ENV

Kopiere `.env.example` nach `.env.local` und fuelle bei Bedarf:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STOCKPILOT_MARKET_PROVIDER=mock
STOCKPILOT_NEWS_PROVIDER=mock
STOCKPILOT_FUNDAMENTALS_PROVIDER=mock
STOCKPILOT_AI_PROVIDER=mock

FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
POLYGON_API_KEY=
TWELVE_DATA_API_KEY=
YAHOO_FINANCE_API_KEY=
NEWS_API_KEY=
OPENAI_API_KEY=
```

## Architektur

- `src/app/page.tsx`: Dashboard mit Watchlist, Gewinnern, Verlierern, Marktueberblick, Trends, News und KI-Marktsentiment.
- `src/app/assets/[symbol]/page.tsx`: Detailseite mit Kurs, Line-Chart, Candlesticks, Volumen, Indikatoren, Fundamentals, News, Analysten, Insider, Earnings und KI-Cases.
- `src/app/portfolio/page.tsx`: Portfolio mit lokalen Kauf-Eingaben, Durchschnittskurs, P/L, Gewichtung und Risiko.
- `src/app/alerts/page.tsx`: Kurs-, RSI-, News-, Volumen-, Earnings- und KI-Risikoalarme.
- `src/app/api/*`: API-Fassade fuer spaetere echte Anbieter.
- `src/lib/providers/*`: austauschbare Provider-Interfaces.
- `src/lib/mock/market.ts`: Mock-Daten fuer MVP und Offline-Demo.
- `src/lib/data-quality.ts`: Datenvalidierung, Quellenranking, Aktualitaet, Mock-Kennzeichnung und Warnungen.
- `src/lib/risk-engine.ts`: Warnsystem fuer Volatilitaet, Liquiditaet, News, Earnings, technische Risiken, Makro-/Sektorrisiken und Datenqualitaet.
- `src/lib/scoring.ts`: transparentes Chancen-/Risiko-Scoremodell und modellbasierte Wahrscheinlichkeiten.
- `src/lib/portfolio-analytics.ts`: Portfolio-Gewichtung, Diversifikation, Szenarioanalyse und Klumpenrisiko.
- `src/lib/api-guard.ts`: Rate Limit, sichere JSON-Fehler, Security Header und Body-Parsing.
- `src/lib/supabase/*`: Supabase-Clients fuer Browser und serverseitige Service-Aufgaben.
- `supabase/schema.sql`: Tabellen und RLS-Policies fuer Nutzerprofile, Watchlists, Alerts, Portfolio und Analyse-Snapshots.

## API-Anbieter spaeter anbinden

Die Provider sind bewusst schmal gehalten. Fuer echte Daten kann je Provider eine Klasse ergaenzt werden:

- Kurse und Candles: Finnhub, Alpha Vantage, Polygon.io, Twelve Data, Yahoo Finance
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

Zusätzlich speichern Dashboard, Watchlist, letzte KI-Analysen, Alerts und Portfolio lokale Snapshots in `localStorage`, damit mobile Nutzer bei schlechter Verbindung weiterarbeiten koennen.

## Risiko- und Datenqualitaetslogik

Jede Detailanalyse zeigt:

- Datenqualitaet inklusive Quellenranking, Zeitstempel, Mock-Kennzeichnung und Warnungen.
- Multi-Layer-Analyse fuer Markttrend, Sektortrend, Sentiment, Volatilitaet und Makro-Faktoren.
- Risiko-Engine mit konkretem Beleg und Pruefhinweis je Warnung.
- Professional Scores: Technical, Fundamental, News, Sentiment, Momentum, Volatility Risk, Liquidity Risk, Event Risk, Gesamt-Chancen-Score und Gesamt-Risiko-Score.
- Modellbasierte Wahrscheinlichkeiten mit dem Hinweis: "Diese Wahrscheinlichkeit ist keine Garantie und kann falsch sein."

Wenn Datenqualitaet zu schwach ist, wird die Analyse als nicht belastbar markiert.

## Supabase

1. Supabase-Projekt erstellen.
2. SQL aus `supabase/schema.sql` im SQL Editor ausfuehren.
3. `.env.local` mit Supabase URL und Keys befuellen.
4. Auth-UI und echte Persistenz koennen auf den vorhandenen Tabellen aufgebaut werden.

## Security, Red Team und Grenzen

- [Security Checklist](./docs/SECURITY_CHECKLIST.md)
- [Red-Team Report](./docs/RED_TEAM_REPORT.md)
- [Test Report](./docs/TEST_REPORT.md)
- [Known Limitations](./docs/LIMITATIONS.md)

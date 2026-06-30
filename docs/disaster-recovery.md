# StockPilot AI Disaster Recovery Runbook

## Ziele

- RTO Public App: unter 15 Minuten durch Vercel Rollback oder Promote eines bekannten guten Deployments.
- RPO User-Daten: abhängig vom Supabase-Backup-Plan. Lokale PWA-Snapshots schützen Watchlist, Portfolio und letzte Analysen nur pro Gerät.
- Keine Anlageberatung: Im Recovery-Fall lieber klar degraded anzeigen als falsche Live-Daten behaupten.

## Sofortdiagnose

```bash
npm run dr:check -- https://stockpilot-ai-beta.vercel.app
npx vercel logs https://stockpilot-ai-beta.vercel.app --level error --since 30m
```

Wichtige Live-Endpunkte:

- `/api/health`: App, Provider, Cache-Modus, Cost Controls.
- `/sw.js`: Service Worker und Offline-Cache-Version.
- `/offline`: PWA-Fallback.
- `/api/market/quotes?symbols=AAPL,BTC-USD`: Marktdaten-Degraded-Check.

## Vercel Rollback

1. Letztes gutes Deployment im Vercel Dashboard oder per CLI identifizieren.
2. Sofort rollbacken oder gutes Preview promoten:

```bash
npx vercel rollback
npx vercel promote <known-good-deployment-url>
```

3. Danach prüfen:

```bash
npm run dr:check -- https://stockpilot-ai-beta.vercel.app
```

## Provider-Ausfall

1. Prüfen, ob nur ein Provider betroffen ist:
   - FMP/Finnhub/Twelve Data für Aktien.
   - Binance/Coinbase für Krypto.
   - Marketaux/NewsAPI für News.
2. Falls Live-Provider ausfällt:
   - Provider-ENV auf Fallback stellen.
   - Qualität sichtbar als `delayed`, `mock` oder `unavailable` belassen.
   - Niemals Mock-Daten als Realtime ausgeben.

## Supabase-Ausfall

1. App bleibt mit lokalen PWA-Snapshots nutzbar.
2. Watchlist und Portfolio zeigen lokale Fallbacks.
3. Keine destructive DB-Aktion ohne Backup-Prüfung.
4. Supabase-Backups/PITR im Supabase Dashboard prüfen.

## Service-Worker- oder Cache-Problem

1. Cache-Version in `public/sw.js` erhöhen, zum Beispiel `stockpilot-static-v5`.
2. Neu deployen.
3. `/sw.js` live prüfen.
4. Nutzer können zusätzlich Browserdaten/Website-Daten löschen, falls ein alter SW hart hängt.

## ENV-Recovery

Kritische Server-ENV:

- `FMP_API_KEY`
- `FINNHUB_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `MARKETAUX_API_KEY`
- `NEWSAPI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

API-Keys niemals mit `NEXT_PUBLIC_` prefixen, außer es ist ausdrücklich ein Public/Anon-Key.

## Monatlicher DR-Drill

1. `StockPilot Disaster Recovery Drill` GitHub Action manuell starten.
2. Fehlerlogs prüfen.
3. Rollback-Prozess trocken durchgehen, aber nicht ohne Grund ausführen.
4. Supabase Backup-Status prüfen.
5. PWA Offline-Test lokal ausführen:

```bash
npm run build
npm run test:e2e -- --project=mobile-chrome tests/e2e/offline-review.spec.ts
```

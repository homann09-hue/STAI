# Release Checklist

## Vor dem Merge

- Branch ist mit `main` synchronisiert.
- Typecheck, Lint, Unit-/Komponententests, Coverage, E2E und Build sind gruen.
- pgTAP laeuft gegen alle Migrationen.
- Dependency-, Lizenz- und Secret-Audit sind gruen.
- Datenqualitaets- und Disclaimer-Texte wurden nicht abgeschwaecht.

## Vor dem Deployment

- Datenbankmigrationen sind angewendet und nachgemessen.
- Supabase Security Advisor hat keine Findings.
- Erforderliche Provider-, Supabase-, Stripe-, Cron- und Vercel-Secrets sind
  in der Zielumgebung gesetzt.
- Das Deployment verwendet ausschliesslich StockPilot-Projekt-IDs.
- Backup-/Rollback-Punkt und verantwortliche Person sind bekannt.

## Nach dem Deployment

- `/api/health` antwortet erfolgreich.
- Der oeffentliche Enterprise-Status ist absichtlich geschuetzt.
- Auth, Watchlist, Portfolio, Alerts und Billing wurden als Kernfluss geprueft.
- Marktdaten zeigen Provider, Qualitaet und Aktualisierungszeit.
- Offline-Seite und Service Worker funktionieren.
- Logs enthalten keine Secrets oder Stacktraces.
- Live-Monitoring ist gruen; bei Fehlern wird zurueckgerollt.

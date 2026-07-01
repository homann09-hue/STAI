# StockPilot AI Supabase Backup and PITR Checklist

Portfolio, watchlist, alert and analysis data are user data. Enterprise readiness requires a verified recovery plan.

## Required checks

- Confirm Supabase project plan and backup capabilities.
- Enable PITR if the plan and risk profile require it.
- Document the maximum acceptable RPO and RTO for user data.
- Confirm who can trigger restore operations.
- Confirm restore testing cadence.
- Confirm that service-role keys are stored only server-side in Vercel/Supabase secret stores.
- Confirm migrations can be replayed from the repository.
- Confirm RLS policies remain active after restore.
- Confirm no destructive database action is performed without a fresh backup.

## Environment gate

Only set this after Supabase backup/PITR has been verified for production:

```bash
STOCKPILOT_ENTERPRISE_SUPABASE_PITR_ENABLED=true
```

## Drill

At least monthly, run:

```bash
npm run enterprise:check -- https://stockpilot-ai-beta.vercel.app
npm run dr:check -- https://stockpilot-ai-beta.vercel.app
```

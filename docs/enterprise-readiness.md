# StockPilot AI Enterprise Readiness

This document is the operating checklist for taking StockPilot AI from beta-quality production to enterprise-grade operation.

## Current readiness position

StockPilot AI is ready to operate as a professional analysis PWA when the automated gates are green. It is not a regulated broker, adviser, exchange, custodian or guarantee engine.

Non-negotiables:

- Never show mock, delayed or cached data as realtime.
- Never expose provider, Supabase service role or cache tokens to the browser.
- Keep the legal notice visible: no investment advice, model outputs can be wrong, investing carries risk.
- Treat user portfolio/watchlist/alert data as private user data protected by RLS.
- Run disaster recovery and enterprise readiness checks before important releases.

## Enterprise check

Run locally:

```bash
npm run enterprise:check -- --local-only
```

Run against the live app:

```bash
npm run enterprise:check -- https://stockpilot-ai-beta.vercel.app
```

The check covers:

- Package identity, pinned dependencies and lockfile.
- QA script matrix.
- Security headers and CSP scope.
- API perimeter controls.
- Secret exposure scan.
- Supabase RLS and policy model.
- Service worker, offline page and DR assets.
- CI/CD gates and manual deploy isolation.
- Live deployment headers, health and public secret exposure.

## Operational targets

- Public app RTO: under 15 minutes via Vercel rollback or promote.
- User data RPO: depends on the Supabase plan and backup/PITR configuration.
- Market data RPO: provider-dependent; always show data quality, provider and last updated timestamp.
- Incident response: follow `docs/disaster-recovery.md`.
- Shared cache: Upstash/Redis or equivalent should be enabled before enterprise customers.

## Security posture

Required:

- CSP, HSTS, frame protection, MIME protection and restrictive permission policy.
- API route body-size limits, rate limits, same-origin checks for user mutations and structured error IDs.
- Structured logs with secret redaction.
- Supabase RLS enabled for every exposed user-data table.
- No `SECURITY DEFINER` functions unless separately reviewed and isolated.
- No `auth.role()`-based authorization.
- Server-only API keys must never use a `NEXT_PUBLIC_` prefix.

## Data and compliance posture

Required before enterprise sales:

- Written provider license review for realtime stocks, ETF data, crypto data, fundamentals and news.
- Data quality label on every market data view.
- Provider outage behavior documented and tested.
- No direct buy/sell recommendation phrased as certainty.
- Clear distinction between model-based estimates and facts from providers.
- Audit trail for material AI analysis versions if users rely on saved analysis snapshots.

## Release gates

Before pushing a production release, run:

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run enterprise:check -- https://stockpilot-ai-beta.vercel.app
npm run dr:check -- https://stockpilot-ai-beta.vercel.app
```

Before activating enterprise customers, additionally confirm:

- Supabase backups/PITR are enabled for the selected plan.
- Upstash/Redis or equivalent shared cache is configured.
- Vercel project secrets are StockPilot-specific and do not reference BauPro.
- Monitoring/alerting covers 5xx spikes, provider failures, quote latency, auth failures and rate-limit spikes.
- Provider contracts allow the displayed data scope and latency claims.

## What is activated in this repository

The repository includes a scheduled `StockPilot Live Monitoring` GitHub Actions workflow. After it is pushed to `main`, GitHub can run live checks every 30 minutes against the production URL.

This is a real baseline monitor, but it is not a full enterprise APM suite. Treat it as the first active safety net before adding Vercel/Sentry/Datadog-style alert routing.

## Manual workflow

GitHub Actions includes a manual Enterprise Readiness workflow. Use it before major releases and after changing auth, provider, cache, CI/CD or deployment configuration.

## Runtime enterprise status API

The app exposes a public, non-secret status endpoint:

```bash
GET /api/enterprise/status
```

The endpoint reports:

- Security controls.
- Supabase RLS readiness.
- Shared cache status.
- Provider credential presence without exposing keys.
- Provider license review status.
- Supabase backup/PITR confirmation status.
- Monitoring and alerting status.
- Incident ownership and SLA status.

The endpoint must not be used as proof that external controls are active unless the matching environment gate is set truthfully.

Related runbooks:

- `docs/provider-licensing.md`
- `docs/monitoring-alerting.md`
- `docs/supabase-backup-pitr.md`

# GitHub-to-goal audit

Stand: 2026-08-10

## Executive result

The repository is a strong pilot-ready FinTech platform with meaningful
security, data-lineage, forecasting, PWA and SaaS foundations. It is not yet a
licensed complete global-market terminal. The largest previous P0 issue, static
mini-universe plus production mock blending, is fixed in this branch.

## Goal comparison

| Goal area | Status | Evidence / gap |
|---|---|---|
| Global instrument discovery | Partial, honest | Dynamic provider search and persistent master; complete directory blocked by provider plan |
| Production market data | Implemented with restrictions | Normalized provider chain, no production mock fallback, per-symbol entitlement |
| Professional detail analysis | Partial | Real quote path and guarded analysis; depth depends on paid fundamentals/history/news |
| Forecast track record | Implemented pilot | Scheduled ledger, evaluation and public track record |
| User SaaS | Implemented foundation | Auth, RLS, portfolios, alerts, entitlements; commercial billing configuration remains environment-dependent |
| Security | Strong | RLS, SSRF controls, CSP, rate limits, secret scan, 0 audit findings |
| Performance | Strong local evidence | 2,000 active sessions pass; single-process 2,000-request burst needs horizontal scaling |
| PWA/iOS | Implemented foundation | Offline E2E passes and Capacitor sync passes; App Store release remains external |
| Operations | Pilot-ready | CI, DR, readiness and evidence scripts; shared cache and production telemetry still required |
| Legal/licensing | Not complete | Provider redistribution and release legal review are external launch gates |

## Priority backlog

### P0 external launch gates

- Buy/configure a provider plan with directory coverage and redistribution rights.
- Configure shared Redis/Upstash before multi-instance scaling claims.
- Run pgTAP in CI and require it before merge.
- Complete legal, privacy and App Store reviews.

### P1 product depth

- Add licensed ETF holdings, classifications and complete fundamentals.
- Add authenticated production telemetry and cost dashboards.
- Add Stripe products/webhooks in production and verify end-to-end billing.
- Run a controlled remote load test against an isolated preview deployment.

### P2 quality growth

- Raise coverage from 36.73%, prioritizing route handlers, provider failures,
  Supabase repositories and client workflows.
- Add visual regression baselines for the main mobile and desktop states.
- Add reconciliation jobs when a licensed directory source becomes available.


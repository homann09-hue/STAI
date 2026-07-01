# StockPilot AI Monitoring and Alerting

World-class operation requires active monitoring, not just passing builds.

## Minimum production alerts

- Scheduled baseline check for `/api/enterprise/status`, `/api/health`, service worker, offline route and DR degradation paths.
- 5xx rate above normal baseline.
- `/api/health` failing or returning stale runtime information.
- `/api/enterprise/status` score drop or missing controls.
- Provider error spike by provider and service.
- Quote latency above acceptable threshold.
- Data quality downgrade from realtime/near-realtime to delayed/mock/unavailable.
- Rate-limit spikes.
- Supabase auth or RLS errors.
- Unexpected public secret pattern in deployed responses.
- Service worker/offline route failures.

## Suggested dashboard widgets

- Request volume by route.
- Error rate by route.
- Provider latency and failure rate.
- Cache mode and cache hit/degraded state.
- Quote freshness by asset class.
- User-data mutation failures.
- PWA install/offline recovery failures.

## Environment gates

Set the baseline flag only after the `StockPilot Live Monitoring` GitHub workflow has been pushed and confirmed to run:

```bash
STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED=true
```

Set the full enterprise flags only when the process is real:

```bash
STOCKPILOT_ENTERPRISE_MONITORING_ENABLED=true
STOCKPILOT_ENTERPRISE_INCIDENT_OWNER=platform-team
STOCKPILOT_ENTERPRISE_SUPPORT_CONTACT=support@example.com
STOCKPILOT_ENTERPRISE_SLA_DOCUMENTED=true
```

Do not put private phone numbers or personal email addresses into public client variables.

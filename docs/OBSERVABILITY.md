# Observability

Stand: 2026-08-10

Structured events include service, environment, timestamp, request ID and
redacted context. Existing signals cover provider failover, API errors, billing
gate uncertainty and readiness checks.

Required production dashboards:

- availability and p50/p95/p99 by route;
- provider success, 402/403/429 rates and latency;
- cache hit/stale/error ratios;
- forecast generation/evaluation coverage;
- auth, billing and webhook failures;
- cost by provider and feature.

Sentry/PostHog or equivalent is not considered configured until DSN/project,
retention and alert destinations are verified in production.


# Release report

Stand: 2026-08-10

## Implemented in this milestone

- Removed the static 19-symbol pseudo-universe from search and screener paths.
- Added one Instrument Master plus provider-backed catalog service.
- Persisted provider search discoveries with explicit incomplete coverage.
- Removed production dashboard construction from mock data.
- Added a fail-closed unavailable market provider.
- Prevented false 404 claims when the catalog cannot verify an identity.
- Isolated QA fixtures from production and stopped load tests hitting paid APIs.
- Corrected anonymous load tests so expected auth gates are not server failures.
- Added mandatory 2,000-user load and stress probes.

## Verification evidence

- Typecheck: passed.
- Lint: passed with zero warnings.
- Unit/integration: 906/906 passed.
- Coverage: 36.73% statements, 35.85% branches, threshold passed.
- Build: passed, 33 static pages generated.
- E2E: 35 passed, 1 intentionally skipped desktop-only mobile case.
- Active users: 2,000/2,000, zero failures, latest p95 527 ms.
- Load microburst release gate: 200 simultaneous requests, zero failures;
  500 remains a mandatory non-gating capacity probe.
- Single-process release gate: 500 concurrent, zero failures.
- Capacity: 10,000/10,000, zero failures, p95 248 ms.
- Chaos: all provider, rate-limit and missing-key scenarios passed.
- Enterprise readiness: 99/100; live target not checked in that local run.
- Institutional controls: 28/28 passed.
- Dependency audit: zero known vulnerabilities.
- iOS Capacitor sync: passed.

## Honest remaining constraints

- FMP plan does not provide a complete directory and gates quotes per symbol.
- 1,000/2,000 instantaneous requests exceed a single local process; production
  horizontal scaling still needs platform telemetry and a remote controlled test.
- Redis/Upstash is not configured locally, so distributed cache/rate limiting
  is not proven.
- Local pgTAP could not connect because no local Supabase/Postgres instance was
  running; CI remains the required database gate.
- Market-data redistribution, news, LGPL and iOS terms require legal review.

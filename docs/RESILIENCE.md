# Provider resilience

StockPilot routes outbound provider requests through one server-side resilience
layer. It protects provider quotas and prevents identical user requests from
multiplying upstream traffic.

## Guarantees

- Identical concurrent requests are coalesced per runtime.
- Every provider has a bounded request budget, burst allowance, concurrency and
  queue.
- `Retry-After` is honored. Network failures, timeouts, HTTP 408/429 and 5xx may
  be retried with bounded exponential jitter.
- Authentication, entitlement, license, invalid-request and missing-symbol
  failures are not retried.
- Repeated transient failures open a provider circuit. Requests fail fast until
  a controlled half-open recovery attempt is allowed.
- Request identities are hashes. URLs and API keys are never exposed in
  resilience metrics or logs.
- Operational limits can be overridden server-side with environment variables.
  They are guardrails, not claims about licensed provider capacity.

## Cache policy

Cache windows are typed by data kind in `src/lib/resilience-policy.ts`.
Realtime quotes remain short-lived, while immutable historical bars and
instrument metadata can remain cached much longer. Stale values are only
available to callers that explicitly use the provider cache fallback and must
retain their original provenance and timestamp.

## Operations

The protected health response exposes aggregate resilience counters and circuit
states. It never exposes request URLs, query parameters or credentials.
Shared cache/rate coordination uses the configured Upstash REST backend; without
it, coordination is process-local and the health response reports that limit.

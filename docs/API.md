# API contract overview

Stand: 2026-08-10

## Public research

- `GET /api/instruments/search?q=&assetClass=&limit=`: dynamic catalog search.
- `GET /api/market/universe?q=&assetClass=&limit=`: normalized discovery view.
- `GET /api/market/quotes?symbols=`: normalized quote batch.
- `GET /api/market/stream`: bounded streaming transport.
- `GET /api/assets/:symbol`: detail or explicit unavailability reason.
- `GET /api/news?symbol=`: source-backed news with cache metadata.
- `GET /api/health`: deployment health without secrets.

## Protected domains

Portfolio, watchlist, alerts, notifications, AI quotas, billing, admin and
reproduction endpoints require their documented authentication/entitlement.
Mutations validate body size/schema and same origin.

## Error semantics

- `400`: invalid input.
- `401/403`: authentication, entitlement or provider-plan restriction.
- `429`: rate limit.
- `503`: provider/configuration unavailable or identity not verifiable.

Every JSON error is normalized and does not expose stack traces or secrets.


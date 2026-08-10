# Data quality policy

Stand: 2026-08-10

## Labels

- `realtime`: licensed provider marks the observation realtime.
- `near_realtime`: short provider delay; not exchange tick data.
- `delayed`: delayed feed, including the current FMP plan.
- `cached`: previously observed provider data within stale policy.
- `historical`: end-of-period observation.
- `mock`: test/development fixture, never production fallback.
- `unavailable`: no verified observation can be supplied.

## Analysis gate

Scores and AI narratives require sufficient, current and source-backed input.
Risk, uncertainty and missing data are separate concepts. Stale or unavailable
inputs do not produce current trading signals.

## Catalog uncertainty

Because the current catalog is incomplete, no missing master record is treated
as proof of nonexistence. The API returns `identity_unverified` rather than a
false 404 for a syntactically valid unresolved symbol.


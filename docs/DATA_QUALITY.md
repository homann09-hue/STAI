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

## Historical price integrity

Historical series expose a machine-readable price basis:

- `adjusted_close`: every usable row contains a provider-supplied adjusted close;
- `unadjusted_close`: no adjustment evidence was supplied;
- `mixed`: adjusted and raw rows are mixed, so backtesting is blocked;
- `unknown`: no usable series exists.

Provider-supplied adjusted close is not presented as independently reconciled
corporate-action coverage. Current historical responses are explicitly marked
`current_snapshot_only`, not point-in-time vintages. Backtests therefore expose
survivorship, selection and look-ahead limitations even when calculation is
possible.

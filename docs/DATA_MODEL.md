# Data model

Stand: 2026-08-10

## Instrument identity

`instruments` stores the canonical identity
`assetClass:exchange:symbol:currency`. Multiple listings remain separate.
`instrument_identifiers` stores provider symbols and exchange identifiers.
Discovery is idempotent: repeat confirmation increases confidence without
resetting first-seen history.

## Market observations

Market quotes and candles are normalized at the provider boundary. Every
observation includes source, observation time, quality, market status and, when
known, latency. Provider payloads are not exposed directly.

## Corporate-action ledger

`corporate_actions` stores idempotent provider or regulatory events separately
from prices. The canonical event identity prevents duplicate dividends and
splits. Type-specific constraints require amounts for cash distributions,
ratios for splits and old/new symbols for symbol changes. `as_of` is the
event's source date; `received_at` records when StockPilot obtained it.
Authenticated clients may read reference events, while ingestion remains
server-only. No event is inferred from a price move.

## User data

Profiles, watchlists, alerts, portfolios, positions, transactions, snapshots,
notifications and entitlements carry `user_id`. RLS enforces
`auth.uid() = user_id` for reads and writes.

## Institutional ledgers

Forecasts, outcomes, model versions, evaluations and intelligence records are
server-only. Forecasts are immutable evidence; outcomes are appended after the
horizon closes.

## Retention classes

- Quotes: short TTL cache, not a durable trade ledger.
- User portfolios and alerts: durable until user deletion.
- Forecast evidence: durable for track-record reproducibility.
- Operational logs: redacted and retained by the deployment platform policy.

# Data coverage

Stand: 2026-08-10

## Current truth

Coverage is search-driven. `coverage.complete` is false. Search results from a
real provider are normalized and persisted in the Instrument Master; later
queries reuse those records without another provider request.

## What is covered

- Stocks, ETFs, crypto, indices and forex are represented by one normalized
  identity and quote contract.
- Detail routes support any syntactically valid symbol that the configured
  provider and plan can resolve.
- The UI exposes quote entitlement and identity confidence.

## What is not claimed

- No complete list of every exchange-listed instrument.
- No guarantee that a symbol searchable at FMP is quote-entitled.
- No guaranteed ISIN/WKN coverage under the current provider plan.
- No millisecond exchange-grade realtime without the required commercial feed
  and redistribution license.

## Completion criterion

Coverage can be marked complete only after a licensed directory sync has run,
reconciliation metrics are stored, and the result is sampled against provider
and exchange totals.


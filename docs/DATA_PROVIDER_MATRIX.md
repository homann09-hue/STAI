# Data provider matrix

Stand: 2026-08-10

| Domain | Primary adapter | Fallback | Current limitation |
|---|---|---|---|
| Instrument search | FMP search-symbol/search-name | persisted Instrument Master | Search-driven, not a complete directory |
| Equity/ETF quotes | FMP | Finnhub, Alpha Vantage | Plan and symbol entitlement dependent |
| Crypto quotes | Binance/Coinbase adapters | configured quote chain | Pair and regional availability dependent |
| History | configured market/history provider | cached stale result | Granularity and horizon are plan dependent |
| Fundamentals | FMP adapter | none when unavailable | Missing fields stay null |
| Company news | Marketaux/NewsAPI adapters | cached stale result | Licensing and rate limits apply |
| SEC filings | SEC EDGAR | none | US issuers only |
| Macro | FRED/SDMX | cached stale result | Publication cadence, not realtime |
| AI narrative | configured AI adapter | deterministic guarded summary | Never used for arithmetic |

FMP measurements from 2026-08-07 are authoritative for the configured plan:
legacy directory endpoints return 403, the stable screener returns 402, search
works, and quote access is gated per symbol. No availability heuristic is used.


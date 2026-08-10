# Data dictionary

Stand: 2026-08-10

| Field | Meaning |
|---|---|
| `canonicalId` | Stable listing identity, including asset class, exchange, symbol and currency |
| `quality` | `realtime`, `near_realtime`, `delayed`, `historical`, `cached`, `mock` or `unavailable` |
| `timestamp` / `asOf` | Provider observation time, not render time |
| `provider` | Human-readable source name |
| `marketStatus` | `open`, `closed`, `pre_market`, `after_hours` or `unknown` |
| `latencyMs` | Estimated age/transport latency when measurable |
| `quoteStatus` | Measured entitlement: `unknown`, `available`, `restricted` or `error` |
| `identityConfidence` | Confidence in symbol/listing resolution, 0 to 100 |
| `resolutionStatus` | `resolved`, `ambiguous`, `provider_only` or `invalid` |
| `sufficientForAnalysis` | Guard indicating whether current inputs support scores/narratives |
| `coverage.complete` | Whether the catalog is proven complete; currently false |

Missing numeric values are `null`/absent. Zero is never used to represent an
unknown fundamental, price or ratio.


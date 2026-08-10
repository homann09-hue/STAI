# Realtime architecture

Stand: 2026-08-10

1. The client subscribes only to visible symbols.
2. `/api/market/stream` validates and caps the symbol set.
3. A provider websocket is used where configured and entitled.
4. REST polling is the explicit fallback with bounded intervals.
5. Quote batches are normalized, deduplicated and throttled before rendering.
6. Heartbeats and reconnects use bounded backoff.
7. Every update carries provider, quality, market status and observation time.

The current free/delayed providers do not justify a generic `Live` label.
Production mock fallback is prohibited. Shared cache and distributed rate
limits require Redis/Upstash before horizontal multi-instance operation.


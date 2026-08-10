# Cost model

Stand: 2026-08-10

Primary variable costs are market requests, news requests, AI generation,
Supabase usage, shared cache, Vercel compute and observability retention.

Controls already present:

- TTL and stale-while-revalidate caches;
- batch quote requests and visible-symbol subscriptions;
- in-flight request deduplication;
- entitlement and daily usage quotas;
- provider usage recording;
- no background forecast generation for unverified symbols.

Commercial launch requires plan-specific provider budgets, alerts at 50/75/90
percent, and a tested fail-closed response when a monthly budget is exhausted.


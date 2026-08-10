# Operations runbook

Stand: 2026-08-10

## Before release

1. Run typecheck, lint, unit tests, coverage, build and E2E.
2. Run load, stress, capacity and chaos tests locally only.
3. Verify Supabase migrations and pgTAP in CI.
4. Verify Vercel environment variables by scope without printing values.
5. Confirm provider licensing and quality labels.
6. Deploy preview, run live readiness, then promote the exact build.

## Provider incident

1. Confirm provider status and HTTP class.
2. Keep mock fallback disabled.
3. Verify secondary provider and cache behavior.
4. Show delayed/cached/unavailable status to users.
5. Record impact window and affected symbols.

## Rollback

Promote the previous known-good Vercel deployment. Database rollback requires
a forward migration unless the documented restore procedure is explicitly
approved.


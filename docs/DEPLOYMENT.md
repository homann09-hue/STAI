# Deployment

Stand: 2026-08-10

1. Use only the STAI Vercel project; never link or deploy BauPro from this
   repository.
2. Configure provider, Supabase, cron and optional Stripe/cache variables in
   the correct Vercel scopes.
3. Build and test the commit in CI.
4. Deploy a preview from the same commit.
5. Verify `/api/health`, headers, public pages, auth gates and data labels.
6. Promote the immutable preview deployment to production.
7. Record commit SHA, deployment URL and remaining warnings in the release
   report.

Production URL: `https://stockpilot-ai-beta.vercel.app`.


# Security threat model

Stand: 2026-08-10

| Threat | Primary controls | Residual risk |
|---|---|---|
| Cross-tenant access | Supabase RLS, authenticated client | Policy regression; covered by pgTAP/CI |
| Secret exposure | server-only modules, env contract, redacted logs | Deployment misconfiguration |
| XSS/injection | schema validation, React escaping, CSP | Third-party content quality |
| CSRF | same-origin checks for mutations | Compromised same-origin script |
| SSRF | HTTPS and hostname allowlist, timeout/body caps | Provider compromise |
| Abuse/rate exhaustion | route rate limits, quotas, cache | Memory limiter is per instance without Redis |
| Billing bypass | server-side entitlements, fail-closed gates | Stripe configuration availability |
| Supply chain | lockfile, pinned packages, audit, SBOM | Transitive package compromise |

Security events must never include tokens, provider payload secrets or user
portfolio content. Service-role access remains limited to documented paths.


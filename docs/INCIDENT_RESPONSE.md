# Incident response

Stand: 2026-08-10

| Severity | Example | Initial response target |
|---|---|---|
| SEV-1 | Cross-tenant exposure, leaked secret, corrupt portfolio writes | Immediate containment |
| SEV-2 | Login/billing outage, widespread incorrect data label | 30 minutes |
| SEV-3 | Single provider outage with correct degraded UI | Business hours |

Containment precedes diagnosis. Rotate exposed credentials, disable affected
paths, preserve audit evidence and communicate only verified facts. After
recovery, write a blameless review with timeline, root cause, impact, corrective
actions and owners.


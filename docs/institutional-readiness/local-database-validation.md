# Local Database Validation Evidence

Status: local validation passed on 2026-07-10. The two validated governance migrations were deployed to the STAI production project on 2026-07-11.

## Scope

- Docker Desktop 29.6.1 on Apple silicon (`aarch64`)
- Supabase CLI 2.109.1
- Fresh local Supabase database only
- Migration replay, pgTAP, RLS/integrity, advisors, schema lint, and restore drill

## Migration history repair

The repository previously used timestamps that did not match the migration versions recorded by the STAI production project. The first local migration also contained only hardening statements and therefore referenced core tables before they existed.

The local history now mirrors the seven already-recorded production versions:

- `20260630132652_stockpilot_initial_schema.sql`
- `20260701104819_add_apply_portfolio_trade_rpc.sql`
- `20260701144505_add_product_readiness_tables.sql`
- `20260710155942_create_realtime_intelligence.sql`
- `20260710160128_harden_realtime_intelligence.sql`
- `20260710201742_harden_portfolio_integrity.sql`
- `20260710201920_index_portfolio_owner_foreign_keys.sql`

The initial migration now bootstraps the core tables required for a clean database. A redundant, never-recorded intermediate migration was removed.

The following migrations were applied through the authenticated Supabase management channel after local validation:

- `20260710221030_add_institutional_governance_controls.sql`
- `20260710221046_harden_institutional_governance_indexes_and_policies.sql`

## Verified results

| Check | Result |
| --- | --- |
| Fresh `supabase db reset --local --no-seed` | Pass |
| Migration replay from an empty database | Pass |
| pgTAP files | 2/2 pass |
| pgTAP assertions | 38/38 pass |
| RLS tenant-isolation checks | Pass |
| Atomic portfolio trade checks | Pass |
| Immutable institutional history checks | Pass |
| Required foreign-key indexes | Pass |
| Explicit deny policies on server-only institutional tables | Pass |
| Supabase security/performance advisors at warning level | No issues found |
| Supabase schema lint | No schema errors found |

## Restore drill

A deterministic synthetic user, profile, two watchlist rows, and one portfolio position were inserted into the local database. A public-schema data dump was created, the database was rebuilt from migrations, the prerequisite synthetic auth user was recreated, and the dump was restored with `psql`.

- Restored data fingerprint: `16faa15f29fa3da91c992cf6c4c0857d`
- Backup SHA-256: `acdb5b1dae57029ffc9bb0f8b4d9ddc89ac45d13f0026bf95853845fec587d29`
- Exact row/value assertions: pass
- Final clean reset after the drill: pass

`supabase db query --file` is not a valid restore mechanism for this dump because it does not process `psql` meta-commands such as `\\copy`. The validated local restore used `psql -v ON_ERROR_STOP=1`.

## Limits and production requirements

- This is local technical evidence, not proof of a production RTO or RPO.
- The data-only dump reports a circular foreign-key warning for versioned intelligence analyses. A production backup workflow must use Supabase managed backups/PITR or a custom-format `pg_dump`/`pg_restore` procedure with controlled trigger handling and a separate restore environment.
- A scheduled production restore exercise, owner sign-off, measured RTO/RPO, retention policy, encryption/key-recovery proof, and evidence archival are still required before enterprise production approval.
- Local Supabase uses shared development secrets and network-accessible development services. The stack must be stopped after testing and must never be exposed as a production service.

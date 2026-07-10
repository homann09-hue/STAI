# Verifikation früherer Audits

Stand: 10.07.2026. Die Einstufung basiert auf Code, Migrationen, Tests und Konfigurationen, nicht nur auf früheren Berichten.

| Früherer Punkt | Status | Technischer Nachweis | Restrisiko |
| --- | --- | --- | --- |
| Mock-Daten als Live-Daten | verified_fixed | `src/lib/data-quality.ts`, DataQuality-Badges, E2E | Provider kann fachlich falsche Daten liefern |
| API-Secrets im Client | verified_fixed | `src/lib/env.ts`, serverseitige Provider, Secret Scan | Bereits extern geteilte Schlüssel müssen rotiert werden |
| Supabase RLS | verified_fixed | Migrationen, `supabase/tests/database/rls_and_integrity.test.sql`, Security Advisor | Lokaler pgTAP-Lauf braucht Docker |
| Portfolio-Overselling/Race | verified_fixed | `20260710201742_harden_portfolio_integrity.sql`, RPC-Rollback-Test | Brokerabgleich fehlt |
| Cross-Tenant Portfolio-FKs | verified_fixed | Composite Owner-FKs und Indizes | Organisationsmandanten noch nicht aktiv |
| Nicht-konstanter Admin-Secret-Vergleich | verified_fixed | `src/lib/admin-access.ts` | Secretrotation organisatorisch erforderlich |
| Unbegrenzte KI-Ein-/Ausgabe | verified_fixed | `src/lib/intelligence/analysis.ts`, Response-Byte- und Tokenlimits | Providerkosten brauchen produktive Budgets |
| Unbegrenzte Realtime-Queue | verified_fixed | Queue-Obergrenze in `market-provider.ts` | Shared Queue fehlt |
| Nicht-atomarer Portfolio-Fallback | verified_fixed | Serverfallback entfernt, atomare RPC | Offline-Demo bleibt lokal getrennt |
| Account-Export und -Löschung | verified_fixed | `/api/account/export`, `/api/account`, Auth-Panel | JWT kann bis Ablauf gültig bleiben |
| Service-Worker Reload-Race | verified_fixed | `PwaRegister.tsx`, PWA-E2E | Plattformabhängige iOS-PWA-Grenzen |
| Mobile Touch Targets | verified_fixed | AppShell-Rechtslink, Mobile-E2E | Externe Accessibility-Prüfung fehlt |
| Dependency-CVEs | verified_fixed | npm Audit: 0 bekannte Findings | Neue CVEs können jederzeit entstehen |
| Provider-Lizenztransparenz | partially_fixed | `docs/provider-licensing.md`, Qualitätsstatus | Verträge/Redistributionsrechte fehlen |
| Intelligence Lineage | partially_fixed | Raw/Normalized/Analysis IDs, Hashes, neue Input-Snapshots | Neue Migration noch nicht produktiv freigegeben |
| Analyse-Reproduzierbarkeit | partially_fixed | Reproduction Runner und Driftvergleich | Legacy-Analysen ohne Snapshot nicht reproduzierbar |
| Institutionelle Audit Logs | partially_fixed | Neue append-only Hashkette und Migration | Kein externes WORM-/SIEM-Ziel aktiv |
| Organisationsrollen | partially_fixed | Rollenmodell und Tenant-Schema, fail-closed Flags | SSO/SCIM/MFA und Adminworkflow fehlen |
| Data-Quality-Quarantäne | partially_fixed | Pipeline-Gate, Quarantänetabelle, Tests | DQ-Operations-Dashboard fehlt |
| Disaster Restore | not_verifiable | Runbook und Smoke-Drill vorhanden | Kein isolierter Restore mangels Testumgebung |
| Multi-Region High Availability | not_fixed | Managed Plattformen, Fallbacks | Kein verifizierter Multi-Region-Failover |
| Verteiltes Rate Limit/Cache | partially_fixed | Upstash-Adapter vorbereitet | Live-Upstash nicht konfiguriert |
| 2.000 Nutzer | verified_fixed | Load/Stress: 0 Fehler im lokalen Abschlusslauf | Kein Produktions-SLA daraus ableitbar |
| 10.000 Sessions | not_verifiable | Testmodell dokumentiert | Lokal noch nicht sicher ausgeführt |
| Backtesting Bias-Kontrollen | partially_fixed | Transparente Demo-/Methodikhinweise | Institutionelle historische Datenbasis fehlt |
| Billing/Entitlements | partially_fixed | Gates fail-closed, Supabase Entitlements | Kein aktives Billingbackend |
| Perfekte/garantierte Rechtskonformität | obsolete | Solche Behauptungen sind verboten | Juristische Prüfung bleibt extern |

## Ergebnis

Keine bekannte ungeklärte Critical-Schwachstelle wurde in der technischen Verifikation bestätigt. Mehrere institutionelle High-Risiken bleiben ausdrücklich offen: Restore-Nachweis, Enterprise-IAM, Providerverträge, zentrales SIEM und Multi-Region-Failover.

# Execution Ledger

Stand: 2026-08-21
Gesamtstatus: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**

<!-- ACTIVE_WORKPOINT: PHASE-1-1-ACCOUNT-DELETION -->

## Aktive Phase

| Feld | Aktueller, belegter Stand |
|---|---|
| Aktive Phase | Phase 1.1 – Stripe-sichere Account-Löschung |
| Arbeitspunkt | Billing vor Identitätslöschung sicher abschließen und Teilfehler wiederaufnehmbar machen |
| Ausgangsfehler | Supabase-User konnte gelöscht werden, während Stripe-Subscriptions weiterliefen |
| Ursache | Ein synchroner Admin-Delete ohne Stripe-Discovery, Saga, Lease, Audit-Trail oder Recovery |
| Implementierung | Re-Auth-Gate, Customer-/Checkout-/Subscription-Discovery, idempotente Kündigung, DB-Saga, Recovery-Cron, pseudonymer Tombstone und Webhook-Kompensation |
| Branch | `codex/phase-1-1-redteam-hardening`, in `main` gemergt |
| Basis-Commit | `c1c114105b9e16ab29b620a8ac4b0faf3d4d1e0b` |
| Pull Request | [#100](https://github.com/homann09-hue/STAI/pull/100) und Red-Team [#101](https://github.com/homann09-hue/STAI/pull/101) gemergt |
| Kernimplementierung und grüne CI-Basis | `75d1772b9ca3978abbe09498ca80c6bc18e50db5` |
| Status | TECHNICALLY COMPLETE – BLOCKED EXTERNAL |

## Verifikationsstand

| Prüfung | Evidenz | Status |
|---|---|---|
| Phase-0-Merge | PR #99, Merge `9d5f91776c4f197e961037a1dda093aa28f54321` | erfolgreich |
| Phase-0-Produktion | `dpl_2ZDn9sQbFaemkmdQmWDszXGMUpaQ`, Root/Health HTTP 200 | erfolgreich |
| Phase-1.1 gezielte Tests | 5 Dateien / 52 Tests | erfolgreich |
| Red-Team gezielte Tests | 4 Dateien / 53 Tests | erfolgreich |
| Kritische Coverage | Löschservice 98,36 % Lines / 85,58 % Branches; Account- und Recovery-Routen 100 % Lines | Gate erfolgreich |
| Typecheck | isolierte attributfreie Arbeitskopie | erfolgreich |
| Gezielter ESLint | 0 Warnungen | erfolgreich |
| Vollständige Unit-/Route-Tests | 157 Dateien / 1.198 Tests | erfolgreich |
| Red-Team Vollsuite | 158 Dateien / 1.207 Tests | erfolgreich |
| Gesamt-Coverage | 48,76 % Statements / 46,17 % Branches / 47,63 % Functions / 50,60 % Lines | Gate erfolgreich |
| Production Build | Next.js 16.3, 35 statische Seiten, TypeScript erfolgreich | erfolgreich |
| Datenbank-Reset und pgTAP | 11 Dateien / 253 Assertions | erfolgreich |
| Red-Team Datenbank-Reset und pgTAP | 11 Dateien / 260 Assertions | erfolgreich |
| Vollständiger ESLint | 0 Warnungen | erfolgreich |
| Dependency Audit | npm moderate/high: 0 bekannte Schwachstellen | erfolgreich |
| Lizenzprüfung | nur bekannte transitive Sharp/libvips-LGPL-Prüfliste | erfolgreich mit Review-Hinweis |
| Browser-E2E | 37 erfolgreich / 1 Desktop-spezifisch übersprungen | erfolgreich |
| Stripe-Testmode-E2E | Testkunde, aktive Subscription und signierter Webhook fehlen | BLOCKED – EXTERNAL |
| Pull-Request-CI | Run 32081208342, 2m43s | erfolgreich |
| Datenbank-CI | Run 32081208399, 253 Assertions | erfolgreich |
| Vercel-Preview-Workflow | Run 32081208465, isolierter StockPilot-Schlüssel | erfolgreich |
| Vercel-Integration | Deployment `4pShsHtC148643jX94DtViSFX8y2` | erfolgreich |
| Red-Team Pull-Request-CI | Run 32505081098 | erfolgreich |
| Red-Team Datenbank-CI | Run 32505081095, 260 Assertions | erfolgreich |
| Red-Team Vercel-Preview | Run 32505081080; natives Deployment erfolgreich, Runtime durch Deployment Protection geschützt | technisch erfolgreich, Runtimeprüfung offen |
| Supabase-Produktionspreflight | Projekt `STAI` ist `INACTIVE`; Restore wegen Free-Limit von zwei aktiven Projekten abgewiesen | BLOCKED – EXTERNAL |

## Nächster zulässiger Schritt

Kontoinhaber muss einen zusätzlichen Supabase-Aktiv-Slot freigeben oder den
Tarif anheben. Danach `STAI` reaktivieren, Migration anwenden und ausschließlich
`stockpilot-ai` deployen. Live-Worker, Logs, Preview-Runtime und Stripe-Testmode
bleiben bis dahin offen. Andere Projekte werden nicht verändert.

# Execution Ledger

Stand: 2026-08-21
Gesamtstatus: **OPEN**

<!-- ACTIVE_WORKPOINT: PHASE-1-1-ACCOUNT-DELETION -->

## Aktive Phase

| Feld | Aktueller, belegter Stand |
|---|---|
| Aktive Phase | Phase 1.1 – Stripe-sichere Account-Löschung |
| Arbeitspunkt | Billing vor Identitätslöschung sicher abschließen und Teilfehler wiederaufnehmbar machen |
| Ausgangsfehler | Supabase-User konnte gelöscht werden, während Stripe-Subscriptions weiterliefen |
| Ursache | Ein synchroner Admin-Delete ohne Stripe-Discovery, Saga, Lease, Audit-Trail oder Recovery |
| Implementierung | Re-Auth-Gate, Customer-/Checkout-/Subscription-Discovery, idempotente Kündigung, DB-Saga, Recovery-Cron, pseudonymer Tombstone und Webhook-Kompensation |
| Branch | `codex/phase-1-1-redteam-hardening` direkt vom gemergten PR #100 |
| Basis-Commit | `c1c114105b9e16ab29b620a8ac4b0faf3d4d1e0b` |
| Pull Request | [#100](https://github.com/homann09-hue/STAI/pull/100) |
| Aktueller Commit | Arbeitsbranch; verbindlicher Hash wird im PR ausgewiesen |
| Status | OPEN |

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

## Nächster zulässiger Schritt

Red-Team-Branch committen, als separaten PR prüfen und mergen. Danach Migration
im Supabase-Projekt `STAI` anwenden und ausschließlich `stockpilot-ai`
deployen. Live-Worker, Logs und Stripe-Testmode bleiben bis dahin offen.

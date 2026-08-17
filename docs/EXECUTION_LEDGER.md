# Execution Ledger

Stand: 2026-08-18
Gesamtstatus: **OPEN**

<!-- ACTIVE_WORKPOINT: PHASE-1-1-ACCOUNT-DELETION -->

## Aktive Phase

| Feld | Aktueller, belegter Stand |
|---|---|
| Aktive Phase | Phase 1.1 – Stripe-sichere Account-Löschung |
| Arbeitspunkt | Billing vor Identitätslöschung sicher abschließen und Teilfehler wiederaufnehmbar machen |
| Ausgangsfehler | Supabase-User konnte gelöscht werden, während Stripe-Subscriptions weiterliefen |
| Ursache | Ein synchroner Admin-Delete ohne Stripe-Discovery, Saga, Lease, Audit-Trail oder Recovery |
| Implementierung | Re-Auth-Gate, Stripe-Customer-/Subscription-Discovery, idempotente Kündigung, DB-Saga, Recovery-Cron und Webhook-Tombstone |
| Branch | `codex/phase-1-1-account-deletion` direkt von verifiziertem `main` |
| Basis-Commit | `9d5f91776c4f197e961037a1dda093aa28f54321` |
| Pull Request | noch nicht erstellt |
| Status | OPEN |

## Verifikationsstand

| Prüfung | Evidenz | Status |
|---|---|---|
| Phase-0-Merge | PR #99, Merge `9d5f91776c4f197e961037a1dda093aa28f54321` | erfolgreich |
| Phase-0-Produktion | `dpl_2ZDn9sQbFaemkmdQmWDszXGMUpaQ`, Root/Health HTTP 200 | erfolgreich |
| Phase-1.1 gezielte Tests | 5 Dateien / 52 Tests | erfolgreich |
| Kritische Coverage | Löschservice 98,36 % Lines / 85,58 % Branches; Account- und Recovery-Routen 100 % Lines | Gate erfolgreich |
| Typecheck | isolierte attributfreie Arbeitskopie | erfolgreich |
| Gezielter ESLint | 0 Warnungen | erfolgreich |
| Vollständige Unit-/Route-Tests | 157 Dateien / 1.198 Tests | erfolgreich |
| Gesamt-Coverage | 48,76 % Statements / 46,17 % Branches / 47,63 % Functions / 50,60 % Lines | Gate erfolgreich |
| Production Build | Next.js 16.3, 35 statische Seiten, TypeScript erfolgreich | erfolgreich |
| Datenbank-Reset und pgTAP | 11 Dateien / 253 Assertions | erfolgreich |
| Vollständiger ESLint | 0 Warnungen | erfolgreich |
| Dependency Audit | npm moderate/high: 0 bekannte Schwachstellen | erfolgreich |
| Lizenzprüfung | nur bekannte transitive Sharp/libvips-LGPL-Prüfliste | erfolgreich mit Review-Hinweis |
| Browser-E2E | 37 erfolgreich / 1 Desktop-spezifisch übersprungen | erfolgreich |
| Stripe-Testmode-E2E | Testkunde, aktive Subscription und signierter Webhook fehlen | BLOCKED – EXTERNAL |
| Pull-Request-CI / Preview | PR noch nicht erstellt | OPEN |

## Nächster zulässiger Schritt

Änderungen committen, pushen und genau einen Phase-1.1-PR eröffnen. Danach CI,
Preview, Produktionsmigration und StockPilot-Deployment verifizieren. Der echte
Stripe-Testmode-Nachweis bleibt bis zur externen Testkonfiguration offen.

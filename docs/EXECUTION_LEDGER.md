# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-1-4 -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 1.4 – atomare und reihenfolgeunabhängige Stripe-Webhooks**
Status: **OPEN**
Branch: `codex/phase-1-4-webhook-ordering`
Basis: `main` bei `f44364678b6386bb3014fe16e6d4f06b361ceb33`
PR: noch nicht erstellt

## Reproduzierter Fehler

Die Webhook-Route prüfte Duplikate, mutierte `entitlements` und schrieb danach `billing_events` in getrennten PostgREST-Aufrufen. Ein Fehler zwischen den Aufrufen hinterließ Teilzustände. Parallele oder verspätete Stripe-Events konnten neuere Entitlements überschreiben. Eine unbekannte Price-ID konnte außerdem auf änderbare Stripe-Metadaten zurückfallen.

## Implementierte Lösung

- eine PostgreSQL-RPC für Ledger und Entitlement in derselben Transaktion
- Unique-Constraint plus Transaktions-Lock je Stripe-Nutzer
- Ordnungsvertrag aus `event.created` und deterministischer Event-ID-Kollisionauflösung
- alte Events als unveränderbare, nicht angewendete Evidenz
- DB-seitige Eingabevalidierung und ausschließlich `service_role`-gebundenes Ausführungsrecht
- keine Metadata-Autorisierung bei unbekannter oder fehlender Price-ID
- echte PostgREST-Concurrency-Prüfung im Datenbank-CI

## Evidenz

- 1.265/1.265 vollständige Vitest-Tests; 29/29 fokussierte Billing-Tests
- 327/327 pgTAP-Assertions nach frischem DB-Reset
- 64 ungeordnete Events und 100 parallele Duplikate gegen lokale PostgREST-RPC
- kritische Coverage 100 % Lines / 91,97 % Branches / 100 % Functions
- Gesamtcoverage 49,84 % Statements / 47,02 % Branches / 48,50 % Functions / 51,75 % Lines
- Format, Typecheck, ESLint, Supabase-Schemalint und Production-Build grün
- Billing-E2E 2/2 auf Mobile und Desktop; Security- und License-Audit grün

## Noch erforderlich

- Commit, PR, Pflicht-CI, Datenbank-CI und StockPilot-Preview
- echte Stripe-Testmode-E2E-Kette in Phase 1.5
- Remote-Migration und Production-Prüfung erst nach Reaktivierung des Supabase-Projekts

Keine Providerphase und kein weiterer Arbeitspunkt ist parallel aktiv.

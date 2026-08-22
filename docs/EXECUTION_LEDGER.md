# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-1-5 -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 1.5 – vollständige Stripe-Testmode-E2E-Kette**
Status: **IN ARBEIT**
Branch: `codex/phase-1-5-stripe-testmode`
Basis: `2ff1ef09edb8b1f8f960c846483203586e170bdd`

## Reproduzierter Fehler

Die Billing-Implementierung war durch Unit-, Browser-, PostgreSQL- und Concurrency-Tests belegt, aber nicht durch einen vollständigen Stripe-Testmode-Lifecycle. Der einzige verbundene Stripe-Connector zeigt `Ovora` im Live-Modus und darf für StockPilot nicht verwendet werden. Im lokalen Environment fehlen Stripe-Testmode-Schlüssel und Preise; Supabase `STAI` ist inaktiv.

## Implementierte Lösung

- lokaler Testmode-Harness mit technischen Sperren gegen Live-Keys, Remote-App und Remote-Supabase
- temporäre Stripe-Testprodukte, Preise, Customers, Subscription und Portal-Konfiguration
- echter Checkout-Routenaufruf, signierte Webhooks, Entitlement-, Portal-, Recovery-, Kündigungs- und Duplikatprüfung
- Account-Löschung mit aktivem Testabo, Checkout-Expiry, Saga-Nachweis und verspätetem Webhook ohne Entitlement-Wiederbelebung
- echte Stripe-Test-Clock-Simulation für fehlgeschlagene Rechnung, `past_due`, Zahlungserholung und Rückkehr zu `active`
- bestmögliches Cleanup auch bei Fehlschlägen
- manueller GitHub-Workflow mit geschütztem Testmode-Secret und isolierter lokaler Supabase-Instanz

## Gemessene interne Evidenz

- 6/6 Harness-Sicherheitsverträge bestanden
- vollständige Suite: 164 Testdateien, 1.271 Tests bestanden
- Format, Governance, Typecheck, ESLint, Coverage-Gate und Build mit 35 Seiten bestanden
- fehlender Testmode-Key stoppt vor jedem Stripe- oder Supabase-Aufruf
- echter Provider-Lifecycle nicht ausgeführt; ein StockPilot-Testmode-Key fehlt
- Stripe CLI 1.50.4 ist installiert; die automatische claimable Sandbox wurde vom Provider abgewiesen und verlangt eine Browser-/Kontofreigabe
- echte PostgREST-Concurrency-Prüfung im Datenbank-CI

## Evidenz

- 1.265/1.265 vollständige Vitest-Tests; 29/29 fokussierte Billing-Tests
- 327/327 pgTAP-Assertions nach frischem DB-Reset
- 64 ungeordnete Events und 100 parallele Duplikate gegen lokale PostgREST-RPC
- kritische Coverage 100 % Lines / 91,97 % Branches / 100 % Functions
- Gesamtcoverage 49,84 % Statements / 47,02 % Branches / 48,50 % Functions / 51,75 % Lines
- Format, Typecheck, ESLint, Supabase-Schemalint und Production-Build grün
- Billing-E2E 2/2 auf Mobile und Desktop; Security- und License-Audit grün
- Code-CI, Datenbank-CI mit echter PostgREST-Concurrency und StockPilot-Preview von PR #107 grün

## Noch erforderlich

- Testmode-Key für StockPilot sicher hinterlegen und den neuen Gate-Lauf belegen
- gehostetes Checkout-UI, Dashboard-Webhook-Delivery/Retry, 3-D-Secure und Test-Clock-Dunning belegen
- Remote-Migration und Production-Prüfung erst nach Reaktivierung des Supabase-Projekts

## Nächster zulässiger Arbeitspunkt

Erst nach grünem Testmode-Gate: Phase 1.5 dokumentarisch abschließen. Keine Live-Aktivierung ohne separate Freigabe.

Keine Providerphase und kein weiterer Arbeitspunkt ist parallel aktiv.

# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-1-5 -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 1.5 – vollständige Stripe-Testmode-E2E-Kette**
Status: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**
Geprüfter Main: `04f8ab162c2c1719a6241a60a5642a5a20e464bb`

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

- Harness-Sicherheitsverträge einschließlich lokaler Zielbindung, Live-Key-Sperre und Test-Clock-Permission-Grenze bestanden
- vollständige Suite: 165 Testdateien, 1.298 Tests bestanden
- Format, Governance, Typecheck, ESLint, Coverage-Gate und Build mit 35 Seiten bestanden
- fehlender Testmode-Key stoppt vor jedem Stripe- oder Supabase-Aufruf
- echter Provider-Lifecycle `32554651375`: Checkout, Portal, signierte Webhooks, Entitlements, Kündigung, Duplicate-Handling, Account-Deletion-Saga, Checkout-Expiry und Late-Webhook-Isolation bestanden
- Profilbereitstellung läuft seit PR #117 ohne `42501`-Warnung; pgTAP-RLS-Verhaltenstest und Datenbank-CI sind grün
- ausschließlich der echte Test-Clock-Dunning-/Recovery-Teil ist mit HTTP 403 blockiert, weil der Claimable-Key keine Test-Clock-Berechtigung besitzt
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

- isolierte Sandbox nach Kontoinhaberfreigabe beanspruchen, vollständigen Testmode-Key sicher hinterlegen und Test-Clock-Dunning/Recovery grün belegen
- gehostetes Checkout-UI, Dashboard-Webhook-Delivery/Retry und 3-D-Secure belegen
- Remote-Migration und Production-Prüfung erst nach Reaktivierung des Supabase-Projekts

## Nächster zulässiger Arbeitspunkt

Erst nach grünem Test-Clock-Gate: Phase 1.5 als `COMPLETE – VERIFIED` freigeben. Keine Live-Aktivierung ohne separate Freigabe.

Keine Providerphase und kein weiterer Arbeitspunkt ist parallel aktiv.

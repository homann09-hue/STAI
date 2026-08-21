# StockPilot Operating Card

<!-- ACTIVE_WORKPOINT: PHASE-1-3 -->

Stand: 2026-08-21

## Arbeitsgrenzen

- Ausschließlich `homann09-hue/STAI`; BauPro und andere Projekte niemals verändern oder deployen.
- Immer nur ein Arbeitspunkt auf aktuellem, geprüftem `main`.
- Keine Secrets committen, loggen oder an den Browser ausliefern.
- Kein Paid-Feature, Mockwert oder Providerstatus als aktiv darstellen, wenn der reale Nachweis fehlt.

## Pflichtablauf

1. Main, Arbeitsbaum, offene PRs, CI und Production-Liveness prüfen.
2. Fehler reproduzieren und Ursache, Verträge sowie Nebenwirkungen erfassen.
3. Implementierung mit Unit-, Route-, Integration-, DB- und relevantem Browser-Test abschließen.
4. Format, Typecheck, Lint, Vitest, Build, DB-Reset, pgTAP, Security- und License-Audit ausführen.
5. Kritische geänderte Dateien auf mindestens 90 % Lines und 85 % Branches messen.
6. Status, Ledger und Blocker mit echten Zahlen aktualisieren.
7. Commit, Branch, PR, Pflicht-CI, Datenbank-CI und StockPilot-Preview prüfen.
8. Erst nach grünem geschütztem Merge und realistischer Prüfung den nächsten Arbeitspunkt beginnen.

## Billing-Invarianten

- Vor jedem Subscription-Checkout Stripe selbst nach allen zugeordneten Customers und nichtterminalen Subscriptions fragen.
- `active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `paused` und unbekannte Zustände erzeugen keinen neuen Checkout.
- Nur `canceled` und `incomplete_expired` sind terminal.
- Mehrere betroffene Customer niemals erraten; fail-closed und Support eskalieren.
- Aktive manuelle Freischaltungen nicht zusätzlich verkaufen.
- Billing bleibt bis Phase 1.5 und echtem Stripe-Testmode-E2E deaktiviert.

## Aktuelle externe Blocker

- Supabase `STAI` ist `INACTIVE`; keine Remote-Migration oder authentifizierte Production-Abnahme.
- Stripe-Testmode-Lifecycle und rechtlich/kommerziell freigegebene Paid-Aktivierung fehlen.

## Incident-Regel

Bei möglichem Doppelabo, falscher Freischaltung, Datenleck oder falschen Marktdaten: Paid-/Datenpfad fail-closed setzen, Ziel und Recovery prüfen, keine destruktive Aktion ohne explizite Freigabe.

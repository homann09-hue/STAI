# Execution Ledger

Stand: 2026-08-21

## Aktiver Arbeitspunkt

**Phase 1.3 – Payment-Recovery und Doppelabo-Schutz**  
Status: **OPEN**  
Branch: `codex/phase-1-3-payment-recovery`  
Commit: `9448bdb`  
PR: [#105](https://github.com/homann09-hue/STAI/pull/105)

## Reproduzierter Fehler

Checkout blockierte nur bei `billingActive`. Zahlfehler und pausierte beziehungsweise unvollständige Stripe-Subscriptions sind nicht aktiv, bestehen bei Stripe aber weiter. Die UI setzte zugleich `canManageBilling` auf false. Dadurch konnte ein zweiter Subscription-Checkout angeboten und gestartet werden.

## Implementierte Lösung

- Customer-Auflösung über bekannte Zuordnung, paginierte Stripe Metadata Search und paginierte E-Mail-Suche
- paginierte Prüfung aller Subscriptions jedes zugeordneten Customers
- nur `canceled` und `incomplete_expired` als terminal
- Portal-Recovery für bestehende nichtterminale Zustände
- fail-closed bei Providerfehler, unbekanntem Status, Mengenüberschreitung oder mehreren betroffenen Customers
- Checkout-Sperre für aktive manuelle Freischaltungen
- verständlicher Recovery-Zustand in Pricing und Account-Billing
- Entfernung unbenutzter Legacy-Stripe-ENV-Namen

## Evidenz

- 1.257/1.257 Vitest
- 300/300 pgTAP nach DB-Reset
- 2/2 Billing-E2E auf Mobile/Desktop
- kritische Coverage 99,28 % Lines / 94,39 % Branches / 100 % Functions
- vollständiger Build, Typecheck, Lint, Security- und License-Audit bestanden

## Noch erforderlich

- Pflichtchecks von PR #105 abwarten und geschützt mergen
- echte Stripe-Testmode-E2E-Kette in Phase 1.5
- Remote-/Produktionsprüfung erst nach Reaktivierung des Supabase-Projekts

Keine Providerphase und kein weiterer Arbeitspunkt ist parallel aktiv.

# Stripe Payment-Recovery und Doppelabo-Schutz

Stand: 2026-08-21

## Zustandsvertrag

| Stripe-Status | Neuer Checkout | Aktion |
|---|---|---|
| `active` | blockiert | Kundenportal |
| `trialing` | blockiert | Kundenportal |
| `past_due` | blockiert | Zahlung im Kundenportal klären |
| `unpaid` | blockiert | Zahlung im Kundenportal klären |
| `incomplete` | blockiert | Checkout/Payment im Kundenportal klären |
| `paused` | blockiert | Status im Kundenportal klären |
| unbekannt | blockiert | fail-closed über Kundenportal/Support |
| `canceled` | erlaubt | neuer Checkout möglich |
| `incomplete_expired` | erlaubt | neuer Checkout möglich |

## Serverseitiger Ablauf

1. Nutzer und Same-Origin-Anfrage verifizieren.
2. Kontolöschungsstatus und Entitlement-Speicher fail-closed prüfen.
3. Bekannte Customer-ID, Stripe Metadata Search und E-Mail-Suche vollständig paginieren.
4. Für jeden zugeordneten Customer alle Subscriptions mit `status=all` paginieren.
5. Bei genau einem Customer mit nichtterminaler Subscription eine Portal-Session erstellen.
6. Bei mehreren betroffenen Customers keinen neuen Checkout erzeugen und Support verlangen.
7. Nur ohne nichtterminale Subscription einen Checkout für den verifizierten Customer erzeugen.
8. Nach Checkout-Erstellung den Kontolöschungsstatus erneut prüfen und eine kollidierende Session verfallen lassen.

## Sicherheits- und Qualitätsgrenzen

- Providerfehler, ungültige Customer-IDs und anomale Mengen führen nicht zu einem Checkout.
- Customer- und Subscription-Anzahlen sind begrenzt, Pagination ist deterministisch.
- Fremde E-Mail-Customer ohne passende `stockpilot_user_id`-Metadaten werden nicht übernommen.
- Provider-IDs bleiben serverseitig und werden aus öffentlichen Entitlements entfernt.
- Eine lokale Entitlement-Zeile ist kein Ersatz für die aktuelle Stripe-Subscription-Prüfung.

## Verifikation

- Recovery-/I/O-/Route-Verträge: 47 Tests im kritischen Coverage-Lauf
- kritische Coverage: 99,28 % Lines, 94,39 % Branches, 100 % Functions
- vollständige Vitest-Suite: 1.257 Tests
- Billing-Playwright ohne Providerkonfiguration: Pixel 7 und Desktop Chrome bestanden

## BLOCKED – EXTERNAL

Ein echter Stripe-Testmode-End-to-End-Nachweis mit Checkout, fehlgeschlagener Zahlung, Portal-Recovery, Webhook und anschließendem Entitlement benötigt aktive Stripe-/Supabase-Testinfrastruktur. Dieser Mock-freie Lifecycle ist noch nicht belegt; Billing bleibt deshalb deaktiviert.

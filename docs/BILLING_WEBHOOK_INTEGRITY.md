# Stripe Webhook Integrity

Stand: 2026-08-22

## Ziel

Verifizierte Stripe-Events dürfen Entitlements genau einmal und nur in nachvollziehbarer Providerreihenfolge verändern. Ledger und Entitlement bilden eine atomare Einheit. Phase 1.4 aktiviert Billing nicht; sie härtet den deaktivierten Pfad für die spätere Stripe-Testmode-Abnahme.

## Vertrauensgrenzen

1. Die Next.js-Route begrenzt den Rohkörper auf 256 KiB und verifiziert die Stripe-Signatur vor jeder Verarbeitung.
2. Nutzer-, Customer-, Subscription- und Price-Zuordnung werden serverseitig validiert.
3. Ausschließlich eine konfigurierte Price-ID bestimmt `pro` oder `premium`. Subscription-Metadaten sind keine Autorisierungsquelle.
4. Nur der Supabase-`service_role` darf `apply_stripe_billing_event` ausführen. `anon`, `authenticated` und `PUBLIC` besitzen kein Ausführungsrecht.

## Transaktionsvertrag

`public.apply_stripe_billing_event` führt in einer kurzen PostgreSQL-Transaktion aus:

- Transaktions-Advisory-Lock je Stripe-Nutzer, ersatzweise je Event-ID
- Duplicate-Prüfung über `unique (provider, event_id)`
- Sperre des bestehenden Stripe-Entitlements
- Vergleich von `provider_created_at` und Event-ID
- unveränderbarer Ledger-Insert
- bedingtes Entitlement-Upsert

Das Feld `applied` ist nur für Stripe-Ereignisse mit diesem Transaktionsvertrag verbindlich. Bei manueller oder älterer Evidenz bleibt es `null`, statt eine nicht belegte atomare Verarbeitung vorzutäuschen.

Schlägt der Entitlement-Upsert fehl, wird auch der Ledger-Insert zurückgerollt. Externe Stripe-Aufrufe finden vor der kurzen Datenbanktransaktion statt und halten keinen DB-Lock offen.

## Reihenfolge

Ein Event ist veraltet, wenn sein `event.created` vor dem zuletzt angewendeten Providerzeitpunkt liegt. Haben zwei Events denselben Providerzeitpunkt, entscheidet die Event-ID deterministisch, damit die Endlage unabhängig von der Ankunftsreihenfolge bleibt. Veraltete Events werden als `ignored`, `applied = false` und `processing_reason = stale_event` protokolliert.

## Retry und Recovery

- Signatur-, Mapping-, Price-, Auth-, Stripe- oder Datenbankfehler antworten fail-closed mit einem sicheren Retry-Status.
- Bereits atomar gespeicherte Event-IDs antworten idempotent erfolgreich.
- Account-Löschung und fehlende Nutzer erzeugen keine neuen Entitlements; soweit erforderlich wird die Stripe-Subscription vor dem Ledger-Eintrag idempotent beendet.
- Ein unbekannter Price darf ein vorhandenes Entitlement niemals überschreiben.

## Nachweise

- Route- und Normalisierungstests für Signatur, Body-Limit, Retry, Replay, Account-Löschungs-Races, unbekannte Price-IDs und stale Events
- pgTAP für Rechte, atomaren Rollback, Replay, Out-of-order- und Tie-Break-Verhalten
- lokaler PostgREST-Test mit 64 ungeordneten Events und 100 parallelen Duplikaten
- kritische Coverage: 100 % Lines, 91,97 % Branches, 100 % Functions

## Externe Abnahme

Die echte Stripe-Testmode-E2E-Kette und die Remote-Migration bleiben bis zur Reaktivierung des Supabase-Projekts `BLOCKED – EXTERNAL`. Kein Production- oder Live-Nachweis wird aus lokalen Tests abgeleitet.

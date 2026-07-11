# ADR-018: Subscription Billing und Entitlements

Status: accepted, disabled-by-default

Datum: 11.07.2026

## Kontext

Die bisherige Preisansicht zeigte ausschließlich vorbereitete Demo-Gates. Ein kommerzielles SaaS darf kostenpflichtige Rechte weder aus Clientzustand noch aus ungeprüften User-Metadaten ableiten.

## Entscheidung

Stripe Checkout und Customer Portal bilden den Zahlungsprovider. Supabase `entitlements` ist das interne System of Record für Laufzeit und Zugriff. Nur signaturgeprüfte Stripe-Webhooks dürfen Stripe-Entitlements schreiben. Feature-Entscheidungen und Nutzungslimits werden serverseitig aufgelöst; atomare Datenbank-Trigger bilden die letzte Schutzschicht.

Der Webhook speichert keine Zahlungs-Rohdaten. Ein unveränderlicher SHA-256-Nachweis schützt Idempotenz und Auditierbarkeit bei geringerer Datensensitivität.

## Konsequenzen

- Fehlende oder fehlerhafte Billing-Konfiguration fällt auf Free zurück.
- Checkout bleibt deaktiviert, bis Secret, Webhook und jeweilige Price-ID gemeinsam vorhanden sind.
- Elite/Business wird nicht automatisch verkauft.
- Steuer-, Rechnungs-, Verbraucherrechts- und Vertragsfragen bleiben externe Freigaben.
- Weitere Billing-Provider können hinter derselben Entitlement-Domäne ergänzt werden.

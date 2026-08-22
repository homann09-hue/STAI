# SaaS Billing und Entitlements

Stand: 22.08.2026

## Sicherheitsmodell

StockPilot vertraut keinem Planwert aus Browser, URL oder User-Metadaten. Bezahlzugriff entsteht ausschließlich aus einer privaten Entitlement-Zeile, die der serverseitige Stripe-Webhook nach erfolgreicher Signaturprüfung aktualisiert. Fehlende Konfiguration, ungültige Sessions, abgelaufene Perioden und nicht aktive Providerstatus fallen auf `free` zurück.

Stripe verlangt für die Signaturprüfung den unveränderten Raw Body. Die Route `/api/billing/webhook` liest deshalb keine vorgeparste JSON-Struktur. Rohdaten werden nicht gespeichert; `billing_events` enthält nur Event-ID, Typ, Status, Zeitstempel und SHA-256-Hash.

## ENV

```bash
STOCKPILOT_APP_URL=https://stockpilot-ai-beta.vercel.app
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_... # optional
```

Alle Werte sind server-only. Ohne vollständige Secret-/Webhook-Konfiguration erzeugt StockPilot keine Checkout-Session.

## Stripe-Einrichtung

1. Getrennte Produkte und wiederkehrende Monats-/Jahrespreise für Pro und Premium im Stripe-Testmodus anlegen.
2. Price-IDs in die serverseitigen ENV-Variablen eintragen.
3. Webhook auf `/api/billing/webhook` konfigurieren.
4. Ereignisse `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` und `customer.subscription.deleted` abonnieren.
5. Webhook-Secret setzen und Testereignisse senden.
6. Erst nach erfolgreichem Test von Checkout, Portal, Verlängerung, Zahlfehler und Kündigung Live-Keys verwenden.

Der reproduzierbare lokale und manuelle CI-Ablauf steht in `docs/STRIPE_TESTMODE_E2E.md`. Er verweigert Live-Schlüssel und Remote-Ziele technisch.

## Datenmodell

- `entitlements`: aktueller, privater Providerstatus je Nutzer und Provider.
- `billing_events`: idempotenter, unveränderlicher Nachweis ohne Raw-Payload.
- `private.current_plan_limit`: serverseitige Planlimits.
- Datenbank-Trigger: atomare Limits für Watchlists, Alerts und Portfolio-Books.

## Fail-closed-Regeln

- `active` und `trialing` können Zugriff erlauben.
- Stripe-Zugriff benötigt zusätzlich eine zukünftige `valid_until`-Zeit und aktive Webhook-Konfiguration.
- `past_due`, `canceled`, `expired`, `incomplete`, `unpaid` und `paused` fallen auf Free zurück.
- Feature-Overrides können enthaltene Funktionen deaktivieren, aber keine unfertige Funktion freischalten.
- Elite/Business bleibt eine manuelle Vertragsfreigabe.

## Betrieb

- Webhook-Fehler müssen über strukturierte Logs und später Error Tracking alarmiert werden.
- Stripe- und Supabase-Secrets regelmäßig rotieren.
- Preisänderungen nicht durch freie Clientwerte, sondern durch neue Stripe Price-IDs ausrollen.
- Refunds, Steuern, Rechnungsanforderungen und Verbraucherrecht vor Live-Betrieb juristisch prüfen.
- Für EU- oder US-Kunden Stripe Tax und die notwendigen Steuerregistrierungen vor Aktivierung bewerten; `automatic_tax` allein erhebt ohne Registrierung keine Steuer.

Billing-Status ist keine Aussage über Datenlizenzen, Finanzaufsicht oder Anlageberatung.

# Sichere Kontolöschung

Stand: 2026-08-21
Status: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**

## Sicherheitsvertrag

Eine Kontolöschung wird nur aus einer serverseitig bestätigten Sitzung
akzeptiert, deren `last_sign_in_at` höchstens zehn Minuten zurückliegt. Die API
verlangt zusätzlich den exakten Bestätigungstext, Same-Origin und das zentrale
Mutation-Rate-Limit.

Vor der Supabase-Identitätslöschung werden alle Stripe-Kunden ermittelt, die
entweder über das serverseitige Entitlement oder über die unveränderliche
`stockpilot_user_id`-Metadatenzuordnung belegt sind. Kunden- und
Subscriptionlisten werden vollständig paginiert. Alle nichtterminalen
Vorhandene offene Checkout-Sitzungen werden vollständig paginiert und beendet,
danach werden alle nichtterminalen Subscriptions idempotent gekündigt. Bei
Stripe-, Timeout-, Mapping- oder Persistenzfehlern bleibt die Identität erhalten.

## Saga-Zustände

```text
requested
  -> cancelling_subscriptions
  -> deleting_identity
  -> completed
```

Vorzeitige Fehler enden in `failed` und können nach einer neuen Anmeldung
wiederaufgenommen werden. Nach bereits begonnener Identitätslöschung bleibt der
Job in `deleting_identity`; ein CRON-geschützter Recovery-Worker übernimmt
abgelaufene Leases und beendet den Vorgang idempotent.

Parallele Requests erhalten nur eine fünfminütige Lease. Jeder Zustandswechsel
und jeder Fehler erzeugt ein server-only Audit-Ereignis. E-Mail, Access Token,
Request Body und Stripe-Payload werden nicht gespeichert.

## Webhook-Rennen und Aufbewahrung

Während der Löschung und nach Abschluss verhindert der Stripe-Webhook anhand
von User-, pseudonymem SHA-256- oder Customer-Tombstone, dass Entitlements neu
angelegt werden. Eine verspätete nichtterminale Subscription wird zusätzlich
aktiv gekündigt; bei Stripe-Fehlern antwortet der Webhook retrybar. Nach
Abschluss wird `user_id` aus dem Job entfernt. Fingerprint und Stripe-Customer-
IDs bleiben ab dem Abschluss höchstens 180 Tage als minimale Race-/Audit-
Evidenz bestehen; der Recovery-Worker löscht danach Job und Audit-Ereignisse.

## Verifikation

- Unit-/Route-/Webhook-Tests: Erfolg, Timeout, Retry, Duplicate, Pagination,
  fehlende Konfiguration, unvollständiges Mapping, Webhook-Race und Recovery.
- pgTAP: RLS, Grants, exklusive Lease, Zustandswechsel, Audit-Trail und
  Entfernung der User-ID nach Abschluss.
- Browser-E2E: Löschoberfläche und API bleiben ohne verifizierte Sitzung auf
  Mobile und Desktop geschlossen.
- Voll-Gates: 158 Testdateien / 1.207 Tests, Typecheck, ESLint und Production-
  Build erfolgreich.
- Datenbank: sauberer Reset mit allen Migrationen und 260 erfolgreichen pgTAP-
  Assertions in 11 Dateien.
- Security: npm-Audit auf `moderate` und `high` ohne bekannte Schwachstellen.
- Noch erforderlich: vollständiger Stripe-Testmode-Durchlauf mit realem
  Customer, aktiver Subscription, signiertem Webhook und kontrolliertem
  Providerfehler.

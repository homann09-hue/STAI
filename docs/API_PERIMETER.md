# API Perimeter

Stand: 2026-08-17

Der CI-Check `npm run security:api-perimeter` analysiert alle Route Handler per
TypeScript-AST. Er erzwingt die Sicherheitsgrenze pro exportiertem Handler,
nicht nur einen Import irgendwo in der Datei.

## Regeln

- Jeder Handler nutzt `rateLimit()`.
- Schreibende Browser-Routen nutzen `requireSameOrigin()`.
- JSON-Mutationen nutzen `parseJsonBody()` mit Größenlimit und Schema.
- Direkte Aufrufe von `request.json()` sind in Browser-Mutationen verboten.

## Geprüfte Ausnahmen

| Route | Grund | Erforderliche Kontrolle |
|---|---|---|
| `/api/billing/webhook` | externer Stripe-Webhook | Signaturprüfung und 256-KiB-Rohbodylimit |
| `/api/intelligence/ingest` | privilegierter Server-Job | Admin-/Cron-Secret und begrenzter Schemaparser |

Neue Ausnahmen müssen im Gate mit Route, Methode, Grund und überprüfbarer
Ersatzkontrolle dokumentiert werden.

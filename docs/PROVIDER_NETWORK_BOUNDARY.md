# Provider Network Boundary

Stand: 2026-08-17

Externe Datenanbieter dürfen ausschließlich über den zentralen, begrenzten
Provider-Transport angesprochen werden. Der CI-Check
`npm run security:provider-boundary` analysiert TypeScript per AST und blockiert
direkte `fetch`-Aufrufe außerhalb der geprüften Transportgrenzen.

## Freigegebene Grenzen

| Datei | Zweck |
|---|---|
| `src/lib/providers/http-json.ts` | einziger allgemeiner Provider-Egress |
| `src/lib/server-cache.ts` | Shared-Cache-Adapter |
| `src/lib/supabase/client-fetch.ts` | Supabase-Transport und Deduplizierung |
| `src/lib/billing/client.ts` | interne Browser-API-Aufrufe |
| `src/lib/use-market-stream.ts` | interner REST-Fallback für Marktdaten |

Eine neue Ausnahme muss im Gate mit einem konkreten Zweck dokumentiert werden.
Provider-Code erhält keine Ausnahme, sondern nutzt `fetchBoundedProviderJson`
oder `fetchBoundedProviderText`.

Zusätzlich blockiert das Gate NewsAPI-Schlüssel in URLs. Die Authentifizierung
erfolgt ausschließlich serverseitig über den freigegebenen `X-Api-Key`-Header.

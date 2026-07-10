# ADR-009: Cache

- Status: accepted, restricted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Memory Cache lokal, optional Upstash für verteilte TTL/Rate Limits; Datenqualität ist Teil des Cachewerts.

## Alternativen

Kein Cache, Vercel Runtime Cache, Redis/Edge Config.

## Auswirkungen

Gute lokale Degradation; live derzeit nicht clusterweit konsistent.

## Sicherheitsfolgen

Tenant/Scope im Key, keine Secrets, Retention kurz.

## Skalierungsfolgen

Upstash vor horizontaler Enterprise-Skalierung aktivieren.

## Kostenfolgen

Requests/Storage budgetieren.

## Betriebsfolgen

Hit Rate, Eviction, Fehler und Stale Serve messen.

## Rückbauoption

Upstash deaktivieren, Memory/Provider-Fallback.

# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-2-3-CANONICAL-STREAM -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 2.3 - kanonische Identität im Market-Stream**

Status: **IMPLEMENTED LOCALLY - PR/CI PENDING**

Geprüfter Main: `255867e783c276335955a2b8925b5132dae006b5`

## Reproduzierte Fehler

`/api/market/stream`, der React-Hook und alle Client-Quote-Maps verwendeten
ausschließlich Symbole. Ein kanonisch aufgelöstes Asset fiel beim SSE-Aufruf
dadurch wieder auf `AAPL` zurück. Außerdem leerte der UI-Throttle seinen
veränderlichen Pending-Puffer, bevor Reacts verzögerter State-Updater ihn las;
Stream-Quotes konnten dadurch vollständig verloren gehen.

## Implementierte Lösung

- expliziter Stream-Vertrag `{ canonicalIds }` oder `{ symbols }`
- gemischte Selektoren und Provider-Symbol-Kollisionen fail-closed
- kanonische Identität in Status-, Quote-, Heartbeat-, Complete- und Error-Events
- Providerantworten vor SSE-Ausgabe an genau ein Listing gebunden
- SSE- und REST-Fallback verwenden denselben Identitätsmodus
- Client lehnt einen Identitäts-Downgrade ab und wechselt kontrolliert zum Polling
- kanonische Quote-Maps ausschließlich nach `canonicalId`
- Asset-Detailseite reicht die serverseitig aufgelöste Listing-ID an den Stream weiter
- Dashboard und Watchlist bleiben transparent im `legacy_symbol`-Modus
- React-Throttle sichert den Pending-Batch unveränderlich vor `setState`

## Evidenz

- 14/14 fokussierte Route-, Domänen- und React-Hook-Tests bestanden
- kritische Stream-Route: 99,02 % Lines und 95,08 % Branches
- Route plus Subscription-Domäne: 99,19 % Lines und 94,8 % Branches
- vollständige Vitest-Suite: 172 Dateien, 1.335/1.335 Tests bestanden
- Format, Governance, TypeScript und ESLint bestanden
- Next.js-Produktionsbuild mit 35 statischen Seiten bestanden

## Abgrenzung

Dieser Arbeitspunkt baut noch keinen zentralen Multi-Client-Realtime-Hub. Das
ist Phase 3. Watchlist-Identitäten werden in einem eigenen Phase-2-Arbeitspunkt
aus dem Datenmodell statt aus Symbolannahmen bezogen.

## Externe Blocker

Öffentliche Anzeigerechte für externe Marktdaten sind weiterhin nicht belegt.
Der Datenpfad bleibt in Production fail-closed; Tests verwenden klar isolierte
Provider-Harnesses und sind kein Live-Marktdatennachweis.

## Noch erforderlich

- PR, Pflicht-CI, pgTAP und isolierte Vercel-Preview
- geschützter Merge und automatisches StockPilot-Production-Deployment
- Live-Abnahme des kanonischen SSE-Vertrags und Logprüfung

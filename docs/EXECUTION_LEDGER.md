# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-2-3-COMPLETE -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 2.3 - kanonische Identität im Market-Stream**

Status: **COMPLETE - VERIFIED**

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

## Release-Evidenz

- PR #123 geschützt als `86c35e33b7b49d3845a01f57846b8a4f5a633724` gemergt
- PR-Code-CI `32568788077`, pgTAP `32568788076` und Vercel-Preview bestanden
- Preview-SSE lieferte `identityMode=canonical`, Listing-ID, Venue und Währung
- Preview-Kollision zweier Listings lieferte kontrolliert HTTP 409
- Main-Code-CI `32568950762` einschließlich Browser-E2E, Performance,
  Dependency-/Lizenz-Audit und SBOM bestanden
- Main-Datenbank-CI `32568950795` bestanden
- Production `dpl_7R2xFtQnhHceMeEhUrPCdG4FFaH3` ist `Ready`
- Alias `https://stockpilot-ai-beta.vercel.app` zeigt auf dieses Deployment
- Startseite, kanonische Asset-Seite und Health liefern HTTP 200
- Production-SSE bewahrt `canonicalId`; Listing-Kollision liefert HTTP 409
- keine Production-Error- oder Warning-Logs im Prüfzeitraum

## Abgrenzung

Dieser Arbeitspunkt baut noch keinen zentralen Multi-Client-Realtime-Hub. Das
ist Phase 3. Watchlist-Identitäten werden in einem eigenen Phase-2-Arbeitspunkt
aus dem Datenmodell statt aus Symbolannahmen bezogen.

## Externe Blocker

Öffentliche Anzeigerechte für externe Marktdaten sind weiterhin nicht belegt.
Der Datenpfad bleibt in Production fail-closed; Tests verwenden klar isolierte
Provider-Harnesses und sind kein Live-Marktdatennachweis.

## Nächster zulässiger Arbeitspunkt

Den nächsten einzelnen Phase-2-Datenpfad vom Symbol auf die kanonische
Listing-Identität umstellen. Dashboard und Watchlist dürfen erst kanonisch
streamen, wenn ihre Datensätze belastbare Listing-IDs tragen.

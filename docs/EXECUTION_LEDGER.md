# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-2-2-COMPLETE -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 2.2 - kanonische Identität für Quote-Batches**

Status: **COMPLETE - MERGED, CI AND PRODUCTION VERIFIED**

Geprüfter Main: `9d536243c8a930fb82e25922d4af3be2c8d9d741`

## Reproduzierter Fehler

`/api/market/quotes` deduplizierte, cachte und ordnete ausschließlich nach
Ticker. Zwei Listings mit gleichem Symbol konnten deshalb im Request, Cache
und Response nicht sicher unterschieden werden. Auch das Autocomplete fragte
Kurse nur anhand des Symbols ab.

## Implementierte Lösung

- `NormalizedQuote` um `canonicalId` erweitert und zentral normalisiert
- neuer reiner Vertrag für `assetClass:exchange:symbol:currency`
- kanonische Batch-Anfrage über `canonicalIds`
- Listing-spezifischer Cache-Key statt reinem Symbol-Key
- kontrollierter HTTP-409-Fehler bei Provider-Symbol-Kollisionen
- Providerantwort wird exakt an eine kanonische Listing-ID gebunden
- Response weist `canonical` oder `legacy_symbol` transparent als Identitätsmodus aus
- Autocomplete nutzt kanonische IDs und Detail-Links transportieren die Listing-ID
- Legacy-Symbolpfad bleibt vorübergehend kompatibel für Stream/Watchlist

## Lokale Evidenz

- TypeScript und ESLint bestanden
- 3 fokussierte Testdateien mit 21/21 Tests bestanden
- kritische Route/Identitätslogik: 99,07 % Lines und 95,69 % Branches
- vollständige Vitest-Suite: 169 Dateien, 1.321/1.321 Tests bestanden
- Format- und Governance-Prüfung bestanden
- Next.js-Produktionsbuild mit 35 statischen Seiten bestanden

## Release-Evidenz

- PR #121 geschützt als `d2e06f14b40e0793dc1d4e963b4aee003e73da60` gemergt
- PR-Code-CI, pgTAP und isolierte Vercel-Preview bestanden
- Main-Code-CI `32567795719` einschließlich Browser-E2E, Performance,
  Dependency-/Lizenz-Audit und SBOM bestanden
- Main-Datenbank-CI `32567795677` bestanden
- Production `dpl_9JfMaasLC5mDUbRBNMewGCduX2J8` ist `Ready`
- Alias `https://stockpilot-ai-beta.vercel.app` zeigt auf dieses Deployment
- Kernseiten, Manifest, Service Worker und Health liefern HTTP 200
- kanonischer Quote-Vertrag liefert HTTP 200 und `identityMode=canonical`
- Provider-Symbol-Kollisionen liefern kontrolliert HTTP 409
- keine Production-Error- oder Warning-Logs im Prüfzeitraum

## Abgeschlossene Release-Automation

PR #120 wurde grün gemergt. Main-Commit
`9d536243c8a930fb82e25922d4af3be2c8d9d741` löste automatisch das StockPilot-
Production-Deployment `dpl_7qdUzszCbZqGsHmYrje7tQ1Ciwp6` aus. Alias,
Kernrouten, Manifest, Service Worker und Health antworteten mit HTTP 200;
Production-Logs enthielten keine Fehler. BauPro wurde nicht verändert.

## Externe Datenblocker

FMP, Finnhub und Alpha Vantage antworten technisch, bleiben in Production aber
bewusst gesperrt. Öffentliche Anzeige- und Weitergaberechte sind nicht belegt;
die Lizenzschranke wird nicht durch Konfigurationstricks umgangen.

## Nächster zulässiger Arbeitspunkt

Die verbleibenden `legacy_symbol`-Aufrufer einzeln auf kanonische Listing-IDs
migrieren. Stream, Watchlist und weitere Datenpfade bleiben getrennte,
getestete Arbeitspunkte; externe Marktdatenrechte werden nicht vorgetäuscht.

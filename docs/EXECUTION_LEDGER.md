# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-2-4-IN-REVIEW -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 2.4 - listinggenaue Provider-Symbolauflösung**

Status: **OPEN**

Geprüfter Ausgangs-Main: `e03c2a633551624474cb57dda0cf7cadf0818f5e`

## Reproduzierter Fehler

`prepareCanonicalQuoteRequest()` setzte `providerSymbol` direkt auf den
öffentlichen Ticker. Ein einzelner Request für
`stock:xetr:aapl:eur` konnte dadurch `AAPL` an einen US-Provider senden und
das NASDAQ-Listing als Xetra-Listing binden. Nur ein gemeinsamer Batch beider
Listings erkannte die Symbolkollision. Die bestehende
`instrument_identifiers.provider_symbol`-Zuordnung wurde nicht gelesen.

Bei einer Provider-Failover-Kette wurde außerdem dasselbe Eingabesymbol an
jeden Anbieter weitergegeben, obwohl Provider unterschiedliche Symbolformate
verwenden können.

Die Production-Abnahme von Main `e03c2a6` reproduzierte einen zweiten Fehler:
Bei inaktivem Supabase lieferten REST und SSE zwar korrekt HTTP 503, benötigten
dafür aber jeweils rund 7,3 Sekunden.

## Implementierte Lösung

- Parsing und Provider-Mapping sind getrennte Verträge
- serverseitige, gebatchte Auflösung aus `instruments` und
  `instrument_identifiers`
- interne Instrument-ID bleibt bis in jede gebundene Quote erhalten
- providerbezogene Symbolauflösung für die gesamte aktive Quote-Kette
- Failover fragt jeden Provider mit dessen eigenem Mapping ab
- kanonisches REST-Polling und SSE verwenden denselben Mapping-Vertrag
- Cache-Key enthält kanonische ID, Instrument-ID, Provider und Provider-Symbol
- fehlende Stores, Instrumente und Mappings sowie Konflikte schlagen
  kontrolliert fehl
- Providerantworten werden nur bei passendem Provider, Provider-Symbol,
  Canonical ID und Währung gebunden
- jede Instrument-Master-Abfrage wird mit `AbortSignal.timeout()` auf maximal
  2.000 Millisekunden begrenzt
- zurückgegebene und geworfene Fetch-Abbrüche werden identisch fail-closed
  normalisiert
- Legacy-Symbolpfad bleibt explizit und unverändert

## Migration

Keine. Das vorhandene Instrument-Master-Schema enthält bereits
`canonical_id`, interne Instrument-ID und providerbezogene Identifier. Der
Arbeitspunkt ergänzt den fehlenden Lese- und Routingvertrag.

## Lokale Evidenz

- Formatcheck, TypeScript und ESLint: bestanden
- fokussierte Tests: 5 Dateien, 33/33 bestanden
- vollständige Vitest-Suite: 174 Dateien, 1.349/1.349 Tests bestanden
- Produktionsbuild: bestanden, 35 statische Seiten
- Mapping-Domäne: 100 % Lines / 89,69 % Branches
- Quote-Route: 97,46 % Lines / 92,95 % Branches
- Stream-Route: 97,39 % Lines / 92,75 % Branches

## Security- und Datenqualitätswirkung

Die Datenbankabfragen sind server-only, gebatcht und begrenzt. API-Schlüssel
oder privilegierte Daten werden nicht an den Client gegeben. Bei fehlender oder
widersprüchlicher Mapping-Evidenz wird kein Provider aufgerufen. Ein
Währungs- oder Identitätskonflikt verwirft die Antwort statt Felder
umzudeuten.

## Externe Blocker

Das Supabase-Projekt `STAI` war zuletzt `INACTIVE`. Der echte
Instrument-Master-Lookup kann deshalb erst nach Reaktivierung remote geprüft
werden. Öffentliche Anzeigerechte für externe Marktdaten sind weiterhin nicht
belegt.

## Nächster Schritt

Timeout-Remediation committen, als Folge-PR prüfen, Pflicht-CI,
Datenbank-CI und Preview abwarten und anschließend die Production-Latenz erneut
messen. Keine weitere Phase beginnen, bevor dieser Arbeitspunkt geschützt
gemergt, deployt und soweit ohne externe Blocker real geprüft ist.

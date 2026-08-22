# Execution Ledger

<!-- ACTIVE_WORKPOINT: PHASE-2-1 -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Phase 2.1 - kanonische Instrument- und Listing-Aufloesung**

Status: **IMPLEMENTED LOCALLY - PR/CI PENDING**

Gepruefter Ausgangsstand: `48315206db9c24bd864ff9346ea4ab9e142cd684`

## Reproduzierter Fehler

Die Detailaufloesung akzeptierte ausschliesslich ein Symbol. Bei mehreren
Listings desselben Symbols waehlt der Instrument Master bislang still die Zeile
mit der hoechsten `confirmation_count`. Der Quote-Status wurde anschliessend
symbolweit auf alle gleichnamigen Listings geschrieben. Handelsplatz, Waehrung
und Instrumentidentitaet konnten dadurch falsch zugeordnet werden.

## Implementierte Loesung

- reine, getestete Aufloesungslogik fuer kanonische Instrument-IDs
- HTTP 409 mit belegten Listing-Kandidaten statt stiller Mehrdeutigkeitswahl
- Asset- und Corporate-Action-Routen rufen bei Mehrdeutigkeit keinen Provider auf
- Cache- und Quote-Status-Schluessel verwenden bei bekannter Identitaet die
  kanonische ID
- kein symbolweiter Quote-Status-Write mehr
- Detail-, Such- und Kataloglinks transportieren `canonicalId`
- mobile Listing-Auswahl zeigt Handelsplatz, Waehrung und MIC transparent
- ungueltige oder veraltete kanonische IDs werden fail-closed abgewiesen

## Gemessene Evidenz

- fokussierte Suite: 6 Dateien, 34/34 Tests
- vollstaendige Suite: 167 Dateien, 1.308/1.308 Tests
- Formatcheck, Governance, Typecheck und ESLint bestanden
- Next.js-Produktionsbuild mit 35 statischen Seiten bestanden
- keine Migration, kein Deployment und keine Aenderung ausserhalb StockPilot

## Konservierter externer Blocker

Phase 1.5 bleibt **TECHNICALLY COMPLETE - BLOCKED EXTERNAL**. Der isolierte
Stripe-Schluessel darf keine Test Clocks erzeugen. Auf ausdruecklichen
Nutzerwunsch wird Stripe vorerst uebersprungen; Billing bleibt deaktiviert.

## Noch erforderlich

- Branch pushen und PR-, Code-CI-, Datenbank-CI- und Preview-Evidenz pruefen
- nach gruenem Merge den Source-Workspace konfliktfrei synchronisieren
- in einem separaten Phase-2-Arbeitspunkt die Quotes-Batchroute und danach die
  Provider-Symbolabbildung vollstaendig kanonisieren

## Naechster zulaessiger Arbeitspunkt

Zuerst Phase 2.1 durch PR/CI abschliessen. Danach ausschliesslich die
Quotes-Batchroute bearbeiten. Keine parallele Stripe-Arbeit, keine
Produktionsaktivierung und keine Aenderung an BauPro.

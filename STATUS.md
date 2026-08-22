# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Gepruefter Ausgangsstand: `main` bei `48315206db9c24bd864ff9346ea4ab9e142cd684`
- Aktive Phase: **Phase 2.1 - kanonische Instrument- und Listing-Aufloesung**
- Aktiver Arbeitsstatus: Implementierung und lokale Qualitaetsgates abgeschlossen; PR-/CI-Evidenz ausstehend
- Billing: deaktiviert; Phase 1.5 bleibt **TECHNICALLY COMPLETE - BLOCKED EXTERNAL**

## Aktueller Arbeitspunkt

Symbolgleiche Listings duerfen nicht mehr stillschweigend anhand ihrer
Bestaetigungszahl ausgewaehlt werden. Asset- und Corporate-Action-Routen loesen
ein Instrument deshalb ueber die kanonische ID auf. Ist ein Symbol mehrdeutig,
antworten sie mit HTTP 409 und liefern die belegten Handelsplaetze zur Auswahl.
Ohne eindeutige Identitaet werden weder Provider aufgerufen noch Quote-Status
ueber mehrere Listings hinweg geschrieben.

Detail- und Kataloglinks transportieren die kanonische Instrument-ID. Die UI
zeigt bei Mehrfachlistings Handelsplatz, Waehrung und MIC und verlangt eine
explizite Auswahl statt einer geratenen Zuordnung.

## Evidenz dieses Arbeitspunkts

- 6 fokussierte Testdateien mit 34/34 Tests bestanden
- vollstaendige Vitest-Suite: 167 Dateien, 1.308/1.308 Tests bestanden
- Format, Governance, Typecheck und ESLint bestanden
- Next.js-Produktionsbuild mit 35 statischen Seiten bestanden
- keine Datenbankmigration und keine Produktionsaenderung

## Externe Blocker

- Stripe Test Clocks sind mit dem isolierten Claimable-Key nicht erlaubt. Stripe
  wurde auf ausdruecklichen Nutzerwunsch vorerst uebersprungen; Billing bleibt
  fail-closed und deaktiviert.
- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte
  Produktionspruefung bleiben blockiert.

## Naechster zulaessiger Schritt

Phase-2.1-Branch pushen, PR-Checks und StockPilot-Preview pruefen und nur bei
vollstaendig gruenen Gates nach `main` mergen. Danach als naechsten isolierten
Arbeitspunkt die symbolbasierte Quotes-Batchroute auf kanonische Instrument-IDs
umstellen. Keine Produktionsaktivierung und keine Aenderung an BauPro.

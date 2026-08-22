# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Gepruefter Ausgangsstand: `main` bei `48315206db9c24bd864ff9346ea4ab9e142cd684`
- Aktive Phase: **Release-Automation - geschuetzte Main-Merges automatisch live**
- Aktiver Arbeitsstatus: Production ist aktuell; automatische Main-Deployments werden aktiviert
- Billing: deaktiviert; Phase 1.5 bleibt **TECHNICALLY COMPLETE - BLOCKED EXTERNAL**

## Aktueller Arbeitspunkt

Der verifizierte Main-Commit `01740e6ab4fca6830aaaa2b67aa7e9564a1f5af0`
ist als Vercel-Production-Deployment `dpl_2bRw6Xg78Fzx8F6QdnLG9XRMXbF6`
unter `https://stockpilot-ai-beta.vercel.app` aktiv. Die bisherige
`deploymentEnabled.main=false`-Sperre wird entfernt, damit geschuetzte
Main-Merges kuenftig automatisch nur das Projekt `stockpilot-ai` aktualisieren.

## Abgeschlossener Phase-2.1-Arbeitspunkt

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
- PR #119: Code-CI, Browser-E2E, Enterprise-Gates, pgTAP und isolierte
  StockPilot-Vercel-Preview bestanden
- keine Datenbankmigration und keine Produktionsaenderung

## Externe Blocker

- Stripe Test Clocks sind mit dem isolierten Claimable-Key nicht erlaubt. Stripe
  wurde auf ausdruecklichen Nutzerwunsch vorerst uebersprungen; Billing bleibt
  fail-closed und deaktiviert.
- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte
  Produktionspruefung bleiben blockiert.

## Naechster zulaessiger Schritt

Release-Automation durch PR-/CI-/Preview-Gates pruefen, geschuetzt mergen und
belegen, dass Vercel den Main-Merge automatisch als StockPilot-Production
ausliefert. Danach die symbolbasierte Quotes-Batchroute auf kanonische
Instrument-IDs umstellen. Keine Aenderung an BauPro.

# Execution Ledger

<!-- ACTIVE_WORKPOINT: RELEASE-AUTO-DEPLOY -->

Stand: 2026-08-22

## Aktiver Arbeitspunkt

**Release-Automation - geschuetzte Main-Merges automatisch live**

Status: **IMPLEMENTED LOCALLY - PR/CI PENDING**

Gepruefter Main: `01740e6ab4fca6830aaaa2b67aa7e9564a1f5af0`

## Reproduzierter Fehler

Das Vercel-Projekt `stockpilot-ai` ist korrekt mit GitHub `homann09-hue/STAI`
und dem Production-Branch `main` verbunden. Das Repository setzte jedoch in
`vercel.json` ausdruecklich `git.deploymentEnabled.main=false`. Dadurch blieben
erfolgreich gemergte und vollstaendig gepruefte Main-Commits aus Production
ausgeschlossen; die Live-Seite war vier Tage hinter GitHub.

## Implementierte Loesung

- automatische Vercel-Deployments fuer den geschuetzten Branch `main` aktiviert
- Projektbindung auf `stockpilot-ai` und Production-Branch `main` verifiziert
- keine Aenderung an Projekt-ID, Team, Domain, Umgebungsvariablen oder BauPro
- Stripe bleibt uebersprungen und Billing deaktiviert

## Live-Evidenz vor der Automatisierung

- Main-Code-CI und Main-Datenbank-CI fuer `01740e6` bestanden
- Production `dpl_2bRw6Xg78Fzx8F6QdnLG9XRMXbF6` ist `READY`
- Alias `https://stockpilot-ai-beta.vercel.app` zeigt auf dieses Deployment
- Dashboard, Maerkte, Aktien, ETFs, Krypto, Watchlist, AAPL-Seite, Manifest,
  Service Worker und Health antworten mit HTTP 200
- Browserkonsole sowie Vercel-Error- und Warning-Logs ohne Findings

## Datenprovider-Blocker

FMP, Finnhub und Alpha Vantage antworten mit den vorhandenen Schluesseln
technisch erfolgreich. Production zeigt dennoch bewusst keine Kurse, weil
keine externen Anzeigerechte in
`MARKET_DATA_LICENSE_VERIFIED_PROVIDERS` und
`MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS` belegt sind. Diese Sperre wird nicht
umgangen; insbesondere erlaubt Finnhub persoenliche Tarife nicht fuer die
oeffentliche Weitergabe ohne schriftliche Freigabe.

## Noch erforderlich

- PR-/CI-/Preview-Gates fuer die Release-Konfiguration abschliessen
- nach geschuetztem Merge das automatisch erzeugte Production-Deployment und
  den Alias pruefen
- kommerzielle/externe Marktdatenrechte schriftlich belegen und erst dann die
  jeweiligen Provider serverseitig freischalten

## Naechster zulaessiger Arbeitspunkt

Zuerst den automatischen StockPilot-Production-Deploy belegen. Danach
ausschliesslich die Quotes-Batchroute kanonisieren. Keine parallele
Stripe-Arbeit und keine Aenderung an BauPro.

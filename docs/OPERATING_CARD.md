# StockPilot AI Operating Card

Stand: 2026-08-16

## Oberstes Produktziel

StockPilot AI wird Phase fuer Phase zu einem belegbar verlaesslichen,
schnellen, sicheren und verstaendlichen Finanzanalyseprodukt entwickelt.
Datenkorrektheit, Stabilitaet, Sicherheit, Nachvollziehbarkeit und ehrliche
Unsicherheit stehen vor Funktionsumfang. Keine Analyse verspricht sichere
Gewinne.

## Aktuelle Phase

- **Phase 7: Alpaca Realtime.**
- REST, Batch, Trades, Market Clock, historische Bars, WebSocket-Lifecycle,
  Provider-Routing, Resilience und Provenienz sind implementiert.
- PR `#85` ist als Main-Commit `2189a9d` gemergt; App-CI und pgTAP sind gruen.
- Der exakte Merge-Build `dpl_2pXDTqyxsc3oR6a2x5MagSwDnUTt` ist als Preview
  READY.
- Phase 7 bleibt offen, bis ein neuer Production-Deploy und der reale
  Produktions-Smoke belegt sind.
- Danach bleibt die echte Alpaca-Aktivierung getrennt `BLOCKED - EXTERNAL`,
  solange Zugangsdaten und Display-/Redistributionsrechte fehlen.

## Verbindliche Qualitaetsregeln

- Keine erfundenen Marktdaten, Kennzahlen, Quellen, Waehrungen oder
  Echtzeitkennzeichnungen.
- Kein stiller Mock-Fallback in Produktion.
- Jeder Datenpunkt behaelt Provider, Feed, fachlichen Datenstand,
  Eingangszeit und Qualitaetsstatus.
- Ungeklaerte Identitaet, stale/divergente Evidenz oder fehlende Rechte
  sperren aktuelle Analysen fail-closed.
- Deterministische Berechnungen statt LLM-Rechenlogik; Prognosen bleiben
  probabilistisch und begruendet.
- Nutzerdaten laufen ueber tokengebundene Supabase-Clients und RLS.
- Secrets bleiben serverseitig; Providerzugriffe nutzen die zentrale
  abgesicherte Fetch-/Resilience-Schicht.
- BauPro niemals veraendern oder deployen. Vercel-Aktionen duerfen nur die
  Projekt-ID `prj_gikdOwKQqTQ0wtrljGljwGcFfwzc` (`stockpilot-ai`) verwenden.

## Aktuelle Blocker

- Vercel blockiert neue Deployments und Promotions nach mehr als 100
  Deployments im rollierenden Tagesfenster. Die bisherige Production bleibt
  gesund online; der Merge-Build darf nicht mit Preview-Umgebungswerten
  unsicher auf die Live-Domain aliasiert werden.
- In StockPilot Production fehlen `ALPACA_API_KEY_ID` und
  `ALPACA_API_SECRET_KEY` sowie bestaetigte externe Anzeigerechte.
- FMP/Twelve Data besitzen weiterhin dokumentierte Tarif-, Coverage- und
  Display-Grenzen.
- Kommerzieller Start benoetigt rechtlich gepruefte Texte und bestaetigte
  Datenlizenzen.

## Definition of Done je Phase

Implementierung, Typecheck, Lint, Unit-/Integrationstests, relevante
Datenbank- und Browserpruefungen, Build, Security, Mobile/Desktop,
Regressionen, Dokumentation, Commit, Push, CI, StockPilot-only-Deployment,
reale Produktionsfunktion und Logkontrolle muessen belegt sein. Ein externer
Blocker wird mit Messwert, Auswirkung und Aktivierungsschritt dokumentiert,
aber nie als erfolgreicher Live-Nachweis umgedeutet.

## Naechste Aktion

Nach Reset des Vercel-Limits den manuellen Production-Workflow fuer Commit
`2189a9d` mit exakter StockPilot-Projektpruefung ausfuehren. Danach Live-Smoke,
DR, Enterprise, 2.000 aktive Sitzungen und Error-/Warning-Logscan wiederholen.
Erst dann Phase 7 abschliessen oder den verbleibenden Alpaca-Vertragsblocker
erneut bewerten.

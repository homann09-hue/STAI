# StockPilot AI Operating Card

Stand: 2026-08-12
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar marktreifen Finanzanalyse-Produkt für aktive Anleger und Trader entwickelt. Priorität: Datenkorrektheit, Stabilität, Sicherheit, tatsächlicher Trader-Mehrwert, Erklärbarkeit, Geschwindigkeit, UX, Funktionsbreite.

## Aktuelle Phase und aktiver Punkt

**Phase 2: Kanonische Instrument-, Quote- und Bar-Domainmodelle.**

Das kanonische Instrumentenmodell ist produktiv abgeschlossen. Aktiver nächster Einzelpunkt ist das kanonische Quote-Modell mit Provider-/Venue-Identität, Bid/Ask/Last, Größen, OHLC, Volumen/VWAP, drei Zeitstempeln, Marktphase, Feedtyp, belegter Verzögerung und zentralem Qualitätsstatus. Keine UI- oder Providerintegration darf diesen Typ umgehen.

## Qualitätsregeln

1. Keine erfundenen Daten, Quellen, Kennzahlen oder Erfolgsmeldungen.
2. Nie `Live`/`Realtime` anzeigen, wenn Daten delayed, cached, mock, stale oder lizenzrechtlich ungeprüft sind.
3. Analysen bei ungeklärtem Instrument, falscher Währung, unzureichender Aktualität oder fehlender Evidenz zurückhalten.
4. Nutzerdaten ausschließlich tokengebunden und RLS-geschützt; Service Role nur in den drei dokumentierten Ausnahmewegen.
5. Secrets ausschließlich serverseitig; Providerabrufe begrenzt, validiert, dedupliziert und SSRF-geschützt.
6. LLMs interpretieren validierte Evidenz, berechnen keine Finanzkennzahlen und erfinden keine Fakten.
7. Genau einen Arbeitspunkt vollständig beenden, bevor der nächste beginnt.

## Aktuelle externe Blocker

- `BLOCKER-001/005`: FMP liefert kein vollständiges Verzeichnis und schaltet Quotes symbolweise frei.
- `BLOCKER-002/009`: Vollständige Realtime- und Display-Rechte benötigen geeignete Datenverträge.
- `BLOCKER-004`: Native iOS-Veröffentlichung benötigt vollständigen Apple-Developer-Zugang.
- `BLOCKER-006`: Vercel Hobby erlaubt Cron-Jobs nur täglich.
- `BLOCKER-010`: Verteilter Produktionscache fehlt.
- `BLOCKER-011`: Kommerzielle Rechts- und Lizenzprüfung ist offen.
- `BLOCKER-012`: Supabase-Schutz gegen bekannte geleakte Passwörter ist deaktiviert.

Details: `docs/BLOCKERS.md`.

## Definition of Done je Arbeitspunkt

Implementierung, Typecheck, Lint, Unit-/Integrationstests, relevante E2E-Tests, Build, Security, Mobile/Desktop, Regressionen und Dokumentation sind geprüft. Danach folgen Commit, Push, grünes CI, kontrollierte Migration, ausschließlich StockPilot-Deployment und reale Produktionsprüfung. Externe Hindernisse werden als `BLOCKED - EXTERNAL` dokumentiert.

## Letzter belegter Produktionsstand

- Kanonisches Instrumentenmodell: PR #65, Merge `508c30a7d72225dd0cbef12fa8e66fd98b7b14fe`.
- Suchranking-Hotfix: PR #66, Merge `9b49193ba724cb860dbf6f326d75d93fb1f8f8b8`.
- Finale Main-Gates: StockPilot CI `31554156481`; Database Tests `31554156442`, 224/224 pgTAP.
- Supabase: Migration `20260812012358`; Schema, Constraints, RLS und RPC-Rechte produktiv geprüft.
- Vercel: `dpl_3xBgzmgrzzciZd67sFZ6uPyMG4Jt`, READY, Alias `stockpilot-ai-beta.vercel.app`.
- Live: `/`, `/markets`, `/assets/AAPL`, `/api/health` jeweils 200; drei exakte `AAPL`-Suchen korrekt; Fehlerlog leer.
- Projektgrenze: ausschließlich `stockpilot-ai`; BauPro blieb unverändert.

## Arbeitsregeln

- Zu Aufgabenstart diese Karte und `docs/EXECUTION_LEDGER.md` lesen.
- Vor Änderungen den echten Repository-, CI- und Live-Stand messen.
- Bestehende Architektur erweitern, keine Parallelarchitektur bauen.
- Provenienz und Datenqualität bis in die UI erhalten.
- BauPro niemals verändern oder deployen.
- `STATUS.md`, Ledger und belegte Blocker nach jedem Meilenstein aktualisieren.

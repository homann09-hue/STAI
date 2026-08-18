# StockPilot AI Operating Card

Stand: 2026-08-17

## Oberstes Produktziel

StockPilot AI wird Phase fuer Phase zu einem belegbar verlaesslichen,
schnellen, sicheren und verstaendlichen Finanzanalyseprodukt entwickelt.
Datenkorrektheit, Stabilitaet, Sicherheit, Nachvollziehbarkeit und ehrliche
Unsicherheit stehen vor Funktionsumfang. Keine Analyse verspricht sichere
Gewinne.

## Aktuelle Phase

- **Phase 12 CoinGecko ist abgeschlossen und vollständig durch GitHub-CI sowie pgTAP verifiziert.**
- Phase 8 Finnhub ist als Commit `c743961` auf GitHub gepusht.
- SEC-Formulare, historische Submission-Segmente, Metadaten, CIK-Auflösung,
  Deduplizierung, Neu-Erkennung und Fair-Access-Limit sind implementiert.
- Phase 9 ist in Draft-PR `#87` vollstaendig gruen: TypeScript, ESLint,
  Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke,
  Performance-/Enterprise-Gates sowie Supabase-RLS und Integritaet.
- Phase 10 erweitert FRED auf 23 US-Reihen und trennt Beobachtung,
  Erstveroeffentlichung, Vintage und Revision. Mit `FRED_API_KEY` arbeitet der
  serverseitige JSON-Client; ohne Schluessel bleibt nur der klar markierte
  offizielle CSV-Fallback.
- Phase 10 ist in Draft-PR `#88` vollstaendig gruen: TypeScript, ESLint,
  Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke,
  Performance-/Enterprise-Gates sowie Supabase-RLS und Integritaet.
- Phase 11 erweitert ECB auf 13 verifizierte Reihen. SDMX-Historienfelder
  trennen Beobachtung, Erstveroeffentlichung, Vintage und Revision; Quelle und
  Serienkennung stehen an jeder Makrokarte.
- Phase 11 ist in Draft-PR `#89` vollstaendig gruen: TypeScript, ESLint,
  1.177 Unit-Tests mit Coverage, Produktions-Build, Browser-Smoke,
  Performance-/Enterprise-Gates, Sprach-, Dependency-, Lizenz- und
  institutionelle Pruefungen. Supabase-RLS/Integritaet war im ersten Lauf
  desselben PR gruen.
- Phase 12 ergänzt Coin-ID-/Paar-Mapping, Metadaten, Blockchain-Adressen,
  Kategorien, Market Cap, Supply, Börsenabdeckung und globale Kryptomarktbreite
  über CoinGecko. Coinbase/Binance bleiben schnelle Kursquellen; CoinGecko wird
  nie als sekündlicher Live-Feed bezeichnet.
- Phase 12 ist in Draft-PR `#90` grün: TypeScript, ESLint, 159 Testdateien /
  1.195 Tests, Produktions-Build, Browser-Smoke, Performance-, Enterprise-,
  Sprach-, Dependency-, Lizenz-, institutionelle und Supabase-RLS-Prüfungen.
- Vercel bleibt auf Nutzerwunsch bis spaeter verschoben.

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

Phase 14 in GitHub-CI pruefen und den Binance-Market-Data-WebSocket mit einem
realen BTCUSDT-Smoke belegen. Vercel bleibt bis zum Reset des Build-Limits
unangetastet; danach ausschliesslich das StockPilot-Projekt deployen.

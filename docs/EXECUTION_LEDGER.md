# StockPilot AI Execution Ledger

Stand: 2026-08-11, 19:00 Uhr MESZ

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
|---|---|
| Phase | Phase 1: bestehende kritische Fehler beheben |
| Aktive Aufgabe | Portfolio-Trade-Mandantengrenze vollständig ausrollen |
| Autoritative Basis | `main` auf `ad69d76291338af4592ba255c7300266593dd84c` |
| Arbeitsbranch | `codex/phase-1-portfolio-tenant-boundary` |
| Repository | `homann09-hue/STAI` |
| Produktion | `https://stockpilot-ai-beta.vercel.app` |
| Vercel-Projekt | ausschließlich `stockpilot-ai`; BauPro bleibt unberührt |

## Implementierter Stand

- `apply_portfolio_trade` akzeptiert keine Nutzer-ID mehr und leitet den Eigentümer ausschließlich aus `auth.uid()` ab.
- Der Anwendungspfad nutzt den tokengebundenen Supabase-Client; Service Role ist für Nutzer-Trades entfernt.
- Die alte UUID-RPC-Signatur wird gelöscht. Nur `authenticated` darf die neue RLS-gebundene Funktion ausführen.
- Direkte RPC-Aufrufe validieren Symbol, Name, Assetklasse, Branche, Seite, Menge, Preis, Währung und Risikowert in PostgreSQL.
- Advisory Lock, Kaufmittelwert, Verkaufskontrolle und transaktionale Seiteneffektfreiheit bleiben erhalten.
- Das lokale Portfolio sendet ohne bestätigte Supabase-Synchronisierung keinen Cloud-POST.
- Das gesamte Transaktionsformular bleibt bis zur abgeschlossenen Hydration deaktiviert; schnelle Eingaben können nicht mehr durch React zurückgesetzt werden.

## Belegte lokale Prüfungen

| Gate | Ergebnis |
|---|---|
| Format | bestanden |
| TypeScript | bestanden |
| ESLint | bestanden, 0 Warnungen |
| Unit/Integration | 128 Dateien, 1.001 Tests bestanden |
| PostgreSQL/pgTAP | 10 Dateien, 201 Prüfungen bestanden; Portfolio-Suite 31/31 |
| Produktions-Build | bestanden, 35 statische Seiten erzeugt |
| Browser/E2E | 35 bestanden, 1 plattformbedingt bewusst übersprungen |
| Parallel-Hydrationstest | 5/5 Desktop-Durchläufe bestanden |

## Offene Punkte dieses Arbeitspunkts

- Branch erstellen, committen und zu GitHub pushen.
- Pull Request durch StockPilot CI, Database Tests und Vercel Preview prüfen.
- Migration `20260811193000_harden_portfolio_trade_tenant_identity.sql` kontrolliert auf das Produktionsprojekt `STAI` anwenden.
- Produktionsrechte und RPC-Signaturen gegenprüfen.
- StockPilot deployen und Portfolio-/Health-Smokes sowie Fehlerlog prüfen.

## Externe Blocker

- `BLOCKER-001/005`: FMP liefert kein vollständiges Instrumentverzeichnis und sperrt Quotes symbolweise.
- `BLOCKER-002/009`: Vollständige Realtime- und Display-Rechte benötigen geeignete Datenverträge.
- `BLOCKER-004`: Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang.
- `BLOCKER-006`: Vercel Hobby erlaubt Cron-Jobs nur täglich.
- `BLOCKER-010`: Verteilter Produktionscache fehlt.
- `BLOCKER-011`: Kommerzielle Rechts- und Lizenzprüfung ist offen.
- `BLOCKER-012`: Supabase-Produktionsschalter und Leaked-Password-Protection bleiben extern offen.

## Letzter abgeschlossener Produktionspunkt

Auth-UI-Härtung ist über PR #53 als `3871420` veröffentlicht. Die Abschlussdokumentation wurde über PR #54 als `ad69d76` gemergt; Main-CI und Datenbanktests sind grün. Die produktive Supabase-Passwortkonfiguration bleibt wahrheitsgetreu als externer Blocker offen.

## Nächster zulässiger Schritt

Portfolio-Mandantengrenze über GitHub prüfen, danach Migration und Deployment kontrolliert freigeben. Erst nach Live-Nachweis beginnt der nächste Phase-1-Befund.

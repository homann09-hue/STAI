# StockPilot AI Execution Ledger

Stand: 2026-08-11

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
|---|---|
| Phase | Phase 1: bestehende kritische Fehler beheben |
| Aktive Aufgabe | Auth-Privilegiengrenze für normale Nutzeranfragen |
| Produktionsstand | `main` auf `a07f7016a4128e507683354e38fdf9487ef9ec01` |
| Arbeitsbranch | `codex/phase-1-auth-privilege-boundary` |
| Repository | `homann09-hue/STAI` |
| Produktion | `https://stockpilot-ai-beta.vercel.app` |
| Vercel-Projekt | ausschließlich `stockpilot-ai`; BauPro blieb unberührt |

## Abgeschlossener Arbeitspunkt

- `apply_portfolio_trade` akzeptiert keine Nutzer-ID mehr und leitet den Eigentümer ausschließlich aus `auth.uid()` ab.
- Der Anwendungspfad nutzt den tokengebundenen Supabase-Client; Service Role ist für Nutzer-Trades entfernt.
- Die alte UUID-RPC-Signatur ist gelöscht. Nur `authenticated` darf die neue RLS-gebundene Funktion ausführen.
- Direkte RPC-Aufrufe validieren Symbol, Name, Assetklasse, Branche, Seite, Menge, Preis, Währung und Risikowert in PostgreSQL.
- Advisory Lock, Kaufmittelwert, Verkaufskontrolle und transaktionale Seiteneffektfreiheit bleiben erhalten.
- Das lokale Portfolio sendet ohne bestätigte Supabase-Synchronisierung keinen Cloud-POST.
- Das Transaktionsformular bleibt bis zur abgeschlossenen Hydration deaktiviert; schnelle Eingaben werden nicht mehr zurückgesetzt.

## Belegte Prüfungen

| Gate | Ergebnis |
|---|---|
| Format | bestanden |
| TypeScript | bestanden |
| ESLint | bestanden, 0 Warnungen |
| Unit/Integration | 128 Dateien, 1.001 Tests bestanden |
| PostgreSQL/pgTAP lokal | 10 Dateien, 201 Prüfungen bestanden; Portfolio-Suite 31/31 |
| Produktions-Build | bestanden, 35 statische Seiten erzeugt |
| Browser/E2E | 35 bestanden, 1 plattformbedingt bewusst übersprungen |
| Parallel-Hydrationstest | 5/5 Desktop-Durchläufe bestanden |
| Pull Request | #55, gemergt als `6df7f4e` |
| Main-CI | Lauf 31515860871 bestanden |
| Main-Datenbanktests | Lauf 31515860967 bestanden |

## Produktionsnachweis

| Beleg | Ergebnis |
|---|---|
| Migration | `20260811193000_harden_portfolio_trade_tenant_identity` angewendet |
| Aktive RPC | `apply_portfolio_trade(text,text,text,text,text,numeric,numeric,text,integer)` |
| Eigentümerbindung | `auth.uid()` aktiv; kein `p_user_id` |
| Ausführungsmodus | `SECURITY INVOKER`, leerer `search_path` |
| Rechte | `authenticated`: EXECUTE; `anon`, `service_role`, `public`: kein EXECUTE |
| Alte Signatur | entfernt |
| Security Advisor | kein Portfolio-Befund |
| Vercel | `dpl_H6FXaQ35nnYeLcw2bbxgJMUm9Cqg`, READY |
| Live-Smoke | `/`, `/api/health`, `/portfolio`, `/assets/AAPL` jeweils HTTP 200 |
| Live-Portfolio | lokale MSFT-Buchung erfolgreich; nur GET, kein Cloud-POST |
| Produktionsfehlerlog | keine Fehler im Prüfzeitraum |

## Offene externe Blocker

- `BLOCKER-001/005`: FMP liefert kein vollständiges Instrumentverzeichnis und sperrt Quotes symbolweise.
- `BLOCKER-002/009`: Vollständige Realtime- und Display-Rechte benötigen geeignete Datenverträge.
- `BLOCKER-004`: Native iOS-Veröffentlichung benötigt Apple-Developer-Zugang.
- `BLOCKER-006`: Vercel Hobby erlaubt Cron-Jobs nur täglich.
- `BLOCKER-010`: Verteilter Produktionscache fehlt.
- `BLOCKER-011`: Kommerzielle Rechts- und Lizenzprüfung ist offen.
- `BLOCKER-012`: Supabase-Produktionsschalter und Leaked-Password-Protection bleiben extern offen.

Der Security Advisor meldet zusätzlich weiterhin den absichtlich begrenzten `consume_feature_quota`-RPC als generische Warnung. Dieser getrennte Pfad ist durch `auth.uid()`, feste Feature- und Grenzwertlisten, leeren `search_path`, atomare Logik und 29 pgTAP-Prüfungen abgesichert.

## Aktiver Befund und Umsetzung

`getSupabaseAuth()` erzeugte bislang vor jeder normalen Nutzeranfrage einen Service-Role-Client und validierte das Token darüber. Jetzt liest der Pfad zuerst das Token, erzeugt ausschließlich den RLS-gebundenen Publishable-Key-Client und validiert es serverseitig mit `auth.getUser(token)`. Das Auth-Ergebnis enthält keinen privilegierten Client mehr.

DSGVO-Export und administrative Kontolöschung erzeugen die Service Role erst innerhalb der jeweiligen Operation. Fehlt die privilegierte Konfiguration, brechen diese beiden Pfade fail-closed ab; normale Nutzeranfragen bleiben davon unabhängig.

## Lokale Abnahme

- Formatprüfung bestanden.
- Typecheck und Lint ohne Warnungen bestanden.
- Sicherheitsregression: 10 gezielte Tests bestanden.
- Gesamtsuite: 129 Testdateien und 1.004 Tests bestanden.
- Produktions-Build: 35 statische Seiten erzeugt.
- Browser/E2E: 35 Tests bestanden, ein reiner Mobile-Test auf Desktop bewusst übersprungen.
- `npm ci` meldet keine bekannten Dependency-Schwachstellen.

## Nächster zulässiger Schritt

Den isolierten Branch committen, per GitHub-CI prüfen und ausschließlich im Vercel-Projekt `stockpilot-ai` ausrollen. Danach Live-Smokes und Fehlerlogs prüfen und den Abschlussnachweis übernehmen. Erst dann den nächsten Phase-1-Befund auswählen; Phase 1 und die Marktreife-Mission bleiben aktiv.

# StockPilot AI Execution Ledger

Stand: 2026-08-11

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
|---|---|
| Phase | Phase 1: bestehende kritische Fehler beheben |
| Aktive Aufgabe | DSGVO-Export-Mandantengrenze |
| Produktionsstand | `main` auf `8bcba2315ecedc1ab2571cb60d5a636dbd40e2b3` |
| Arbeitsbranch | `codex/phase-1-export-tenant-boundary` |
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

## GitHub- und Produktionsnachweis

| Beleg | Ergebnis |
|---|---|
| Pull Request | #57, gemergt als `3ceac72` |
| PR-CI | vollständig grün einschließlich Vercel-Vorschau und pgTAP |
| Main-CI | Lauf `31518017780` vollständig grün |
| Main-Datenbanktests | Lauf `31518017734` vollständig grün |
| Produktion | `dpl_5a5ih8TAvs1mqcJE8ND8RC8iwAeq`, READY |
| Live-Alias | `https://stockpilot-ai-beta.vercel.app` |
| Live-Smokes | `/`, `/api/health`, `/watchlist`, `/portfolio`, `/settings` jeweils HTTP 200 |
| Session-Fallback | anonymes und ungültiges Token bleiben lokal, `cloudSync: false` |
| Produktionsfehlerlog | keine Fehler im Prüfzeitraum |
| BauPro | nicht verändert und nicht deployt |

## Aktiver Befund und Umsetzung

Der DSGVO-Export las bislang alle persönlichen Tabellen über einen Service-Role-Client und umging damit RLS pauschal. Jetzt verwendet jede Exportabfrage den tokengebundenen Nutzerclient. `billing_events` erhält ausschließlich SELECT für eigene Zeilen über eine explizite `auth.uid()`-Policy; `authenticated` besitzt weiterhin weder INSERT-, UPDATE- noch DELETE-Rechte.

In `user-data.ts` entsteht die Service Role damit nur noch innerhalb der administrativen Kontolöschung. Ein Zwei-Mandanten-pgTAP-Test belegt, dass ein Nutzer genau sein eigenes Billing-Ereignis und keine fremde Zeile sieht.

## Lokale Abnahme

- Formatprüfung, Typecheck und Lint bestanden.
- Sicherheitsregression: 11 gezielte Tests bestanden.
- Gesamtsuite: 129 Testdateien und 1.005 Tests bestanden.
- PostgreSQL: 10 pgTAP-Suiten und 207 Prüfungen bestanden; Billing-Suite 21/21.
- Produktions-Build: 35 statische Seiten erzeugt.
- Browser/E2E: 35 Tests bestanden, ein reiner Mobile-Test auf Desktop bewusst übersprungen.

## Nächster zulässiger Schritt

Den isolierten Branch committen und über GitHub-CI prüfen. Danach Migration `20260811200000` kontrolliert auf das Produktionsprojekt `STAI` anwenden, Advisor und Mandantengrenze erneut prüfen und ausschließlich StockPilot deployen. Erst nach Live-Smoke und Fehlerlogprüfung folgt der nächste Phase-1-Befund.

## Abschlussnachweis - Phase 1 DSGVO-Export-Mandantengrenze

- **Datum:** 2026-08-11
- **Implementierung:** `9ef1eb9` (`security: bind user export to RLS`)
- **Merge:** PR #59, `ff9d45529e48df9b7acd268432e9ccf4c7c91c64`
- **Produktionsmigration:** `harden_billing_export_tenant_boundary`, erfolgreich
- **Produktionsrechte:** RLS aktiv; Eigentümer-SELECT über `auth.uid()`; keine Nutzer-Schreibrechte; anonyme Rolle gesperrt
- **PR-Gates:** Anwendung, pgTAP und Vercel-Preview erfolgreich
- **Main-Gates:** StockPilot CI `31520423798` und Database Tests `31520423808` erfolgreich
- **Deployment:** `dpl_3eUzVsgZy6tBpLjz3SAgohqTHDo7`, READY
- **Live-Smoke:** Startseite, Health, Billing und Settings 200; Export ohne Session 401
- **Restbeobachtung:** FMP-429 mit funktionierendem Provider-Fallback; separat als Provider-Kapazitätsrisiko weiterverfolgen
- **Projektgrenze:** BauPro nicht angefasst

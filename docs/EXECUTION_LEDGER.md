# StockPilot AI Execution Ledger

Stand: 2026-08-11

## Aktueller Arbeitszustand

| Feld             | Tatsächlicher Stand                                    |
| ---------------- | ------------------------------------------------------ |
| Phase            | Phase 2: kanonische Instrument-/Quote-/Bar-Modelle     |
| Aktive Aufgabe   | Kanonisches Instrumentenmodell                         |
| Produktionsstand | `main` auf `3231ac6d32a8bcc750aa74467334cd6e6f1f9d27`  |
| Arbeitsbranch    | `codex/phase-2-canonical-instrument`                   |
| Repository       | `homann09-hue/STAI`                                    |
| Produktion       | `https://stockpilot-ai-beta.vercel.app`                |
| Vercel-Projekt   | ausschließlich `stockpilot-ai`; BauPro blieb unberührt |

## Abgeschlossener Arbeitspunkt

- `apply_portfolio_trade` akzeptiert keine Nutzer-ID mehr und leitet den Eigentümer ausschließlich aus `auth.uid()` ab.
- Der Anwendungspfad nutzt den tokengebundenen Supabase-Client; Service Role ist für Nutzer-Trades entfernt.
- Die alte UUID-RPC-Signatur ist gelöscht. Nur `authenticated` darf die neue RLS-gebundene Funktion ausführen.
- Direkte RPC-Aufrufe validieren Symbol, Name, Assetklasse, Branche, Seite, Menge, Preis, Währung und Risikowert in PostgreSQL.
- Advisory Lock, Kaufmittelwert, Verkaufskontrolle und transaktionale Seiteneffektfreiheit bleiben erhalten.
- Das lokale Portfolio sendet ohne bestätigte Supabase-Synchronisierung keinen Cloud-POST.
- Das Transaktionsformular bleibt bis zur abgeschlossenen Hydration deaktiviert; schnelle Eingaben werden nicht mehr zurückgesetzt.

## Belegte Prüfungen

| Gate                    | Ergebnis                                                   |
| ----------------------- | ---------------------------------------------------------- |
| Format                  | bestanden                                                  |
| TypeScript              | bestanden                                                  |
| ESLint                  | bestanden, 0 Warnungen                                     |
| Unit/Integration        | 128 Dateien, 1.001 Tests bestanden                         |
| PostgreSQL/pgTAP lokal  | 10 Dateien, 201 Prüfungen bestanden; Portfolio-Suite 31/31 |
| Produktions-Build       | bestanden, 35 statische Seiten erzeugt                     |
| Browser/E2E             | 35 bestanden, 1 plattformbedingt bewusst übersprungen      |
| Parallel-Hydrationstest | 5/5 Desktop-Durchläufe bestanden                           |
| Pull Request            | #55, gemergt als `6df7f4e`                                 |
| Main-CI                 | Lauf 31515860871 bestanden                                 |
| Main-Datenbanktests     | Lauf 31515860967 bestanden                                 |

## Produktionsnachweis

| Beleg                | Ergebnis                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| Migration            | `20260811193000_harden_portfolio_trade_tenant_identity` angewendet             |
| Aktive RPC           | `apply_portfolio_trade(text,text,text,text,text,numeric,numeric,text,integer)` |
| Eigentümerbindung    | `auth.uid()` aktiv; kein `p_user_id`                                           |
| Ausführungsmodus     | `SECURITY INVOKER`, leerer `search_path`                                       |
| Rechte               | `authenticated`: EXECUTE; `anon`, `service_role`, `public`: kein EXECUTE       |
| Alte Signatur        | entfernt                                                                       |
| Security Advisor     | kein Portfolio-Befund                                                          |
| Vercel               | `dpl_H6FXaQ35nnYeLcw2bbxgJMUm9Cqg`, READY                                      |
| Live-Smoke           | `/`, `/api/health`, `/portfolio`, `/assets/AAPL` jeweils HTTP 200              |
| Live-Portfolio       | lokale MSFT-Buchung erfolgreich; nur GET, kein Cloud-POST                      |
| Produktionsfehlerlog | keine Fehler im Prüfzeitraum                                                   |

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

| Beleg                | Ergebnis                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| Pull Request         | #57, gemergt als `3ceac72`                                                   |
| PR-CI                | vollständig grün einschließlich Vercel-Vorschau und pgTAP                    |
| Main-CI              | Lauf `31518017780` vollständig grün                                          |
| Main-Datenbanktests  | Lauf `31518017734` vollständig grün                                          |
| Produktion           | `dpl_5a5ih8TAvs1mqcJE8ND8RC8iwAeq`, READY                                    |
| Live-Alias           | `https://stockpilot-ai-beta.vercel.app`                                      |
| Live-Smokes          | `/`, `/api/health`, `/watchlist`, `/portfolio`, `/settings` jeweils HTTP 200 |
| Session-Fallback     | anonymes und ungültiges Token bleiben lokal, `cloudSync: false`              |
| Produktionsfehlerlog | keine Fehler im Prüfzeitraum                                                 |
| BauPro               | nicht verändert und nicht deployt                                            |

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

## Aktive Aufgabe - Phase 1 Provider-429-Stabilisierung

- **Branch:** `codex/phase-1-provider-rate-limit`
- **Belegter Fehler:** mehrere gleichzeitige FMP-Quote-Anfragen der Startseite endeten in HTTP 429.
- **Ursache:** Chained Batches verwendeten Cache und Backoff auf Kettenebene statt auf den inneren Providern; FMP war zugleich Standard-Primary.
- **Umsetzung:** providerweise Batch-Auflösung, konservative FMP-Parallelität, strukturierter Retry-After und Quote-spezifische Providerreihenfolge.
- **Status:** Implementierung angelegt; lokale und externe Abschlussnachweise ausstehend.

## Abschlussnachweis - Phase 1 Provider-429-Stabilisierung

| Beleg                      | Ergebnis                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| Implementierung            | PR #61, Merge `fc790088ad59edf1e5da43245ac015d73146e236`                     |
| CI-Infrastruktur           | PR #62, Merge `4aafd4ea0a3a4abcd190965a75afe0676fdd8428`                     |
| Provenienzkorrektur        | PR #63, Merge `743497c0cd7810e451e611899f2b80a7254df4e9`                     |
| Lokale Gates               | Format, TypeScript, ESLint, 130 Dateien / 1.011 Tests, Build mit 35 Seiten   |
| Browser                    | 35 bestanden, 1 bewusst übersprungen                                         |
| Lasttest                   | 2.000 aktive Sitzungen, 2.000 HTTP 200, 0 HTTP-Fehler, p95 1.155 ms, Peak 52 |
| Stress-Gate                | bis 500 parallel ohne Fehler; 1.000/2.000 separat mit je 75 Client-Timeouts  |
| Finale Main-CI             | `31524154601`, erfolgreich                                                   |
| Finale Main-Datenbanktests | `31524154520`, erfolgreich; 207 pgTAP-Prüfungen                              |
| Produktion                 | `dpl_87usaNbURyTjfTNwLaqzsPTmZmjx`, READY                                    |
| Live-Alias                 | `https://stockpilot-ai-beta.vercel.app`                                      |
| Live-Smoke                 | `/`, `/markets`, `/assets/NVDA`, `/api/health`, Quote-Batch: HTTP 200        |
| Quote-Provenienz           | Sammelquelle Finnhub; 10/10 `near_realtime`; kein Mock/Unavailable           |
| Produktionslog             | ein gemeinsamer FMP-Backoff, keine symbolweise 429-Welle                     |
| Projektgrenze              | ausschließlich StockPilot; BauPro nicht geändert oder deployt                |

Die früher beobachtete 429-Welle ist damit technisch und produktiv behoben. Ein einzelner Upstream-Backoff bleibt erwartbares Providerverhalten und wird jetzt gebündelt, zwischengespeichert und ohne falsche Echtzeit- oder Quellenangabe behandelt.

## Nächster zulässiger Schritt

Den Abschlussnachweis über die vollständigen GitHub-Gates mergen. Danach genau einen weiteren Phase-1-Befund anhand messbarer Sicherheits- oder Produktwirkung auswählen; die übergeordnete Marktreife-Mission bleibt aktiv.

## Aktive Aufgabe - Phase 2 Kanonisches Instrumentenmodell

- **Branch:** `codex/phase-2-canonical-instrument`
- **Ausgangslücke:** Der Instrument Master unterschied wesentliche Listingfelder wie Instrumenttyp, Börsencode, MIC, Zeitzone, Präzision und Aktiv-/Delistingstatus nicht explizit. API-Treffer trugen keine zentrale kanonische Form.
- **Domain:** `CanonicalInstrument` und `ProviderInstrumentMapping` bilden alle im Masterprompt verlangten Identitätsfelder ab; unbekannte Werte sind explizit `null`.
- **Validierung:** MIC, ISIN und FIGI werden formal geprüft. Widersprüchliche Aktiv-/Delistingwerte werden auf der Domainseite zurückgehalten und durch eine Datenbank-Constraint abgewiesen.
- **Persistenz:** Migration `20260811213000_extend_canonical_instrument_model.sql` ergänzt die Felder und hält die bestehende privilegierte RPC-Signatur stabil.
- **API:** Instrumentkatalog und Marktuniversum reichen die kanonischen Listingfelder samt tatsächlichen Provider-Mappings bis zur Suchausgabe weiter.

## Lokale Abnahme Phase 2

| Gate                          | Ergebnis                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| TypeScript-Format             | bestanden                                                  |
| Gezielte Domain-/Katalogtests | 4 Dateien / 16 Tests bestanden                             |
| TypeScript                    | bestanden                                                  |
| ESLint                        | bestanden, 0 Warnungen                                     |
| Unit/Integration              | 131 Dateien / 1.015 Tests bestanden                        |
| Produktions-Build             | bestanden, 35 Seiten                                       |
| Browser/E2E                   | 35 bestanden, 1 bewusst übersprungen                       |
| pgTAP-Pläne                   | alle stimmen; Instrument-Suite 41 Assertions               |
| Lokale Datenbankausführung    | nicht gelaufen: Docker-Backend nach ENOSPC nicht verfügbar |

## Nächster zulässiger Schritt Phase 2

Implementierung committen und über PR-CI prüfen. Der isolierte GitHub-Datenbankworkflow muss die Migration und alle pgTAP-Suiten bestehen. Erst danach darf die Migration auf Supabase-Produktion angewendet werden; anschließend folgen ausschließlich StockPilot-Deployment, reale Such-/Schema-Smokes und Abschlussdokumentation.

## Aktiver Hotfix - Instrumentensuche nach Produktions-Smoke

- **Ausgangsstand:** PR #65 ist als `508c30a7d72225dd0cbef12fa8e66fd98b7b14fe` gemergt; Main-CI `31553281620` und Database Tests `31553281554` sind erfolgreich.
- **Produktion:** Migration `20260812012358` ist angewendet; Deployment `dpl_3Y7vph8PPxvP5w4s7SAX2TNaTf8w` ist READY und bedient den StockPilot-Live-Alias.
- **Live-Befund:** Bei einer wiederholten Suche nach `AAPL` konnte `AAPL.NE` wegen hoeherer `confirmation_count` vor dem exakten Ticker erscheinen.
- **Ursache:** Persistierte und neu gelieferte Treffer wurden zusammengefuehrt, ohne eine gemeinsame querybezogene Rangfolge zu berechnen.
- **Korrektur:** Exaktes Symbol, exaktes Anzeigesymbol und exakte Kennung erhalten voneinander getrennte absolute Relevanzstufen. Symbol-/Namensnaehe folgt danach; Aufloesungs-, Kurs-, Herkunfts-, Konfidenz- und Bestaetigungswerte entscheiden nur innerhalb einer Relevanzstufe.
- **Status:** Implementierung und Regressionstests angelegt; alle lokalen und externen Abschlussgates stehen noch aus.
- **Projektgrenze:** Ausschliesslich StockPilot; BauPro bleibt unberuehrt.

## Abschlussnachweis - Kanonisches Instrumentenmodell und Suchranking

| Beleg                 | Ergebnis                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Domain und Persistenz | PR #65, Merge `508c30a7d72225dd0cbef12fa8e66fd98b7b14fe`                                    |
| Suchranking-Hotfix    | PR #66, Merge `9b49193ba724cb860dbf6f326d75d93fb1f8f8b8`                                    |
| Lokale Gates          | TypeScript, ESLint, 131 Dateien / 1.017 Tests, Build mit 35 Seiten                          |
| Browser               | 35 bestanden, 1 redundanter Desktop-Mobile-Lauf bewusst uebersprungen                       |
| PR-CI                 | `31553969385` erfolgreich                                                                   |
| PR-Datenbank          | `31553969403` erfolgreich; 10 Dateien / 224 pgTAP-Pruefungen                                |
| Finale Main-CI        | `31554156481` erfolgreich                                                                   |
| Finale Main-Datenbank | `31554156442` erfolgreich                                                                   |
| Supabase-Produktion   | Migration `20260812012358`; Schema, Constraints, RLS und RPC-Rechte direkt geprueft         |
| Produktionsdeployment | `dpl_3xBgzmgrzzciZd67sFZ6uPyMG4Jt`, READY                                                   |
| Live-Alias            | `https://stockpilot-ai-beta.vercel.app`                                                     |
| Live-Smoke            | Startseite, Maerkte, AAPL und Health HTTP 200                                               |
| Rankingregression     | Drei wiederholte Suchen: `AAPL` / NASDAQ / `stock:nasdaq:aapl:usd` jeweils Rang 1           |
| Transparenz           | `coverage.complete: false`, `mode: search_driven`; unbekannte Referenzfelder bleiben `null` |
| Produktionslog        | keine Fehler im Abnahmezeitraum                                                             |
| Projektgrenze         | nur `stockpilot-ai`; BauPro nicht veraendert oder deployt                                   |

Der Instrumenten-Arbeitspunkt ist abgeschlossen. Die uebergeordnete Marktreife-Mission bleibt aktiv.

## Naechster einzelner Arbeitspunkt - Kanonisches Quote-Modell

Phase 2 wird mit einem zentralen Quote-Vertrag fortgesetzt. Er muss Instrument-/Provider-/Venue-Identitaet, Bid/Ask/Last und Groessen, OHLC, Previous Close, Change, Volumen, VWAP, Marktphase, Event-/Provider-/Empfangszeit, Realtime-Nachweis, gemeldete Verzoegerung, Feedtyp und Quality Status providerunabhaengig abbilden. Bestehende Quote-Pfade werden erst nach Bestandsaudit migriert; keine unbelegte Echtzeitannahme und kein Parallelmodell.

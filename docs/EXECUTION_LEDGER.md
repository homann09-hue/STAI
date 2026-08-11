# StockPilot AI Execution Ledger

Stand: 2026-08-11, 17:47 Uhr MESZ

## Aktueller Arbeitszustand

| Feld | Tatsächlicher Stand |
|---|---|
| Phase | Phase 1: bestehende kritische Fehler beheben |
| Aktive Aufgabe | Quota-Mandantengrenze auf `auth.uid()` verlagern, vollständig prüfen und ausrollen |
| Autoritative Basis | `main` auf `8094eca973db73f42029aa6d3da770c72f4f6b5f` |
| Arbeitsbranch | `codex/phase-1-quota-tenant-boundary` |
| Repository | `homann09-hue/STAI` |
| Produktion | `https://stockpilot-ai-beta.vercel.app` |
| Vercel-Projekt | ausschließlich `stockpilot-ai`; BauPro bleibt unberührt |

## Erledigte Arbeit im aktiven Arbeitspunkt

- P1-Befund bestätigt: `consume_feature_quota` akzeptierte eine vom Service-Role-Anwendungspfad übergebene `user_id`.
- Anwendung auf den tokengebundenen Supabase-Client umgestellt.
- Neue RPC-Signatur akzeptiert keine Nutzer-ID und leitet den Eigentümer ausschließlich aus `auth.uid()` ab.
- Alte RPC-Signatur wird entfernt; anonyme und Service-Role-Ausführung der neuen Anwendungs-RPC werden entzogen.
- 29 pgTAP-Zusicherungen decken Rechte, zwei getrennte Mandanten, Atomarität, Null-Limit, Feature-Whitelist und Limitbegrenzung ab.
- Zwei statische Regressionstests sichern den korrekten Client und das fehlende `p_user_id`-Argument.
- Route-Guard-Abdeckung geprüft: keine API-Route ohne sichtbaren zentralen Guard gefunden.
- Provider-Secrets werden nicht über `NEXT_PUBLIC_*` referenziert.

## Offene Fehler

- Supabase Security Advisor meldet `auth_leaked_password_protection`: Schutz gegen bekannte geleakte Passwörter ist deaktiviert.
- Lokale pgTAP-Ausführung ist auf diesem Rechner blockiert, weil Docker Desktop nicht läuft. GitHub-CI ist der verbindliche Migrationsgate.
- Die Phase-1-Migration ist noch nicht auf Produktion angewendet und der Anwendungscode noch nicht veröffentlicht.

## Technische Blocker

- Kein verteilter Produktionscache. Multi-Instanz-Rate-Limits und Provider-Cache sind deshalb noch nicht horizontal belastbar.
- Instrumentabdeckung ist suchgetrieben und nachweislich nicht vollständig.
- Produktionsreife Realtime-Streams benötigen eine geeignete Laufzeit und belastbare Feed-Verträge.

## Externe Blocker

- FMP-Verzeichnis und einzelne Quotes sind tariflich gesperrt.
- Realtime-, Display-, Speicher- und Redistributionsrechte sind nicht vollständig vertraglich geprüft.
- Apple-Developer-Zugang für eine native iOS-Veröffentlichung fehlt.
- Kommerzielle Rechtsprüfung ist offen.
- Vercel-Hobby-Cronfrequenz ist auf täglich begrenzt.
- Supabase Leaked Password Protection ist deaktiviert und laut offizieller Dokumentation tarifabhängig.

## Secrets und Zugänge

Vorhandene Secrets werden hier absichtlich nicht aufgelistet. Noch nicht live verifiziert und bis zum Nachweis als fehlend zu behandeln sind insbesondere Alpaca, FRED und CoinGecko sowie produktionsfähige Lizenzzugänge für vollständige Realtime-/Display-Daten.

## Letzte belegte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Installation | `npm ci`, 549 Pakete, 0 bekannte npm-Audit-Schwachstellen |
| Format | erfolgreich |
| Typecheck | erfolgreich |
| Lint | erfolgreich, 0 Warnungen |
| Unit/Integration | Phase-0-Basis: 124 Dateien/988 Tests; neuer Quota-Grenztest: 2/2 erfolgreich |
| pgTAP | 29 Zusicherungen vorbereitet; lokale Ausführung mangels Docker offen |
| E2E | Phase-0-Basis: 35 erfolgreich, 1 bewusst übersprungen |
| Build | Phase-0-Basis erfolgreich, 35 statische Seiten |
| GitHub-CI | letzter Main-Run 31507787579 erfolgreich |
| Datenbanktests | letzter Main-Run 31507787565 erfolgreich |
| Produktion | Deployment `dpl_7MPY7GpLg5BmCJDu8veXB8MkeLxo`, Status READY |

## Nächster zulässiger Schritt

Quota-Fix vollständig validieren, per PR durch pgTAP prüfen, Migration kontrolliert auf STAI anwenden und erst nach Live-Nachweis den nächsten Phase-1-Befund bearbeiten.
## Phase 1 - lokaler Gate-Nachweis (2026-08-11)

| Gate | Ergebnis | Beleg |
|---|---|---|
| Format | bestanden | `npm run format:check` |
| TypeScript | bestanden | `npm run typecheck` |
| ESLint | bestanden | `npm run lint` |
| Unit/Integration | bestanden | 125 Dateien, 990 Tests |
| Build | bestanden | 35 statische Seiten erzeugt |
| Browser/E2E | bestanden | 35 bestanden, 1 bewusst übersprungen |
| Dependency Audit | bestanden | 0 bekannte npm-Schwachstellen |
| Enterprise/Institutional | bestanden | 99/100 ohne Live-URL; 28/28 |
| Datenbank/pgTAP | CI ausstehend | 29/29 Assertions statisch gezählt; lokal kein Docker |

# Externe Blocker

Dieses Dokument listet ausschließlich Blocker, die **nicht durch Code lösbar** sind.
Jeder Eintrag nennt den Nachweis, die betroffene Funktion und die konkreten
Aktivierungsschritte.

Letzte Verifikation: 2026-08-10

---

## BLOCKER-001 — FMP-Tarif liefert kein Instrumentverzeichnis

**Schweregrad:** hoch — betrifft die zentrale Produktanforderung „vollständiges
Instrumentuniversum".

**Nachweis.** Direkt gegen die Live-API mit dem konfigurierten `FMP_API_KEY`
geprüft am 2026-08-07:

| Endpunkt | HTTP | Bedeutung |
|---|---|---|
| `v3/stock/list` | 403 | Legacy-Endpunkt, von FMP abgeschaltet |
| `v3/etf/list` | 403 | Legacy-Endpunkt, von FMP abgeschaltet |
| `v3/available-traded/list` | 403 | Legacy-Endpunkt, von FMP abgeschaltet |
| `v3/symbol/available-forex-currency-pairs` | 403 | Legacy-Endpunkt, abgeschaltet |
| `v3/symbol/available-cryptocurrencies` | 403 | Legacy-Endpunkt, abgeschaltet |
| `v3/symbol/available-indexes` | 403 | Legacy-Endpunkt, abgeschaltet |
| `stable/company-screener` | 402 | Nicht im aktiven Tarif |
| `stable/available-exchanges` | 402 | Nicht im aktiven Tarif |
| `stable/exchange-market-hours`, `stable/holidays-by-exchange` | 429 bei Verifikation am 2026-08-10 | Provider-Limit verhindert derzeit eine produktive Schema-/Coverage-Verifikation; UI und API bleiben bis zu einem erfolgreichen Abruf ehrlich `unknown`/`unavailable` |
| `stable/search-isin` | 402 | Nicht im aktiven Tarif |
| `stable/search-symbol` | **200** | nutzbar |
| `stable/search-name` | **200** | nutzbar |
| `stable/quote` | **200** | nutzbar |

**Betroffene Funktionen.**

- Ein Vollabzug des Instrumentuniversums ist nicht möglich.
- ISIN-basierte Identität ist nicht möglich; jede Identität bleibt
  providergebunden.
- Ein serverseitiger Screener über das Gesamtuniversum ist nicht möglich.
- Eine Börsen-/Handelsplatzliste kann nicht vom Provider bezogen werden.

**Was trotzdem implementiert ist.** Vollständig, nicht als Platzhalter:

- Provider-Adapter `src/lib/providers/instrument-directory-provider.ts` über
  beide nutzbaren Suchendpunkte, mit Dedupe, Timeout, SSRF-Allowlist und
  Degraded-Handling.
- Persistenter Instrument Master (`instruments`, `instrument_identifiers`,
  Migration `20260807190000`) mit RLS, server-only Schreibrecht und idempotentem
  `upsert_instrument`.
- Identitätsbewertung `src/lib/instrument-identity.ts` mit Konfidenz,
  Auflösungsstatus und sichtbaren Warnungen.
- Such-API `GET /api/instruments/search` mit zwei Pfaden (Master zuerst, Provider
  als Erweiterung) und explizitem `coverage.complete: false`.
- Unit-Tests gegen die reale Antwortstruktur.

**Aktivierungsschritte, sobald ein Tarif mit Verzeichniszugriff vorliegt.**

1. Tarif prüfen, der `stable/company-screener` und `stable/available-exchanges`
   freischaltet.
2. In `instrument-directory-provider.ts` eine Funktion `fetchProviderDirectory()`
   ergänzen. Das Schema ist vorbereitet: `discovery_source` kennt bereits den
   Wert `provider_directory`.
3. Einen Sync-Job anlegen, der seitenweise über `upsert_instrument` schreibt.
4. `instrumentDirectoryCapabilityReport()` auf `directorySyncAvailable: true`
   umstellen und die Tests in
   `src/lib/providers/instrument-directory-provider.test.ts` anpassen.
5. `coverage.complete` in der Such-API erst dann auf `true` setzen, wenn der
   Sync nachweislich durchgelaufen ist.

**Ausdrücklich nicht getan.** Es werden keine Mock-Instrumente ergänzt, um
Vollständigkeit vorzutäuschen. Eine Suche ohne Treffer liefert ein leeres
Ergebnis mit Begründung.

---

## BLOCKER-005 — FMP gated Kursabruf auf Symbolebene

**Schweregrad:** hoch — die Suche findet mehr Instrumente, als analysierbar sind.

**Nachweis.** `stable/quote` mit dem konfigurierten Schlüssel, 2026-08-07:

| Symbol | Handelsplatz | HTTP |
|---|---|---|
| AAPL | NASDAQ | 200 |
| MSFT | NASDAQ | 200 |
| SPY | AMEX | 200 |
| EURUSD | FOREX | 200 |
| GCUSD | COMMODITY | 200 |
| BTCUSD | CRYPTO | 200 |
| ^GSPC | INDEX | 200 |
| **QQQ** | NASDAQ | **402** |
| **BTCS** | NASDAQ | **402** |
| SPYM, SPYX | AMEX | 402 |
| AAPL.DE, APC.F | XETRA, FSX | 402 |

**Warum das wichtig ist.** SPY liefert, QQQ nicht. AAPL liefert, BTCS nicht.
Beide Paare teilen Assetklasse und Handelsplatz. Es gibt **keine ableitbare
Regel** — FMP schaltet einzelne Symbole frei. Jede Heuristik wäre falsche
Sicherheit.

**Konsequenz für das Produkt.** Die Suche kann Instrumente finden, deren
Detailseite keinen Kurs zeigen kann. Ohne Kennzeichnung wäre das genau die
Schein-Fertigstellung, die Regel 10 verbietet.

**Was implementiert ist.**

- `instruments.quote_status` (`unknown` / `available` / `restricted` / `error`)
  plus `quote_checked_at`, Migration `add_instrument_quote_status`.
- `src/lib/quote-entitlement.ts` trennt Tarifsperre (402/403, dauerhaft) von
  Betriebsfehler (Timeout, 5xx, vorübergehend). Ein Timeout darf ein Instrument
  nicht dauerhaft als gesperrt markieren.
- Die Asset-Route schreibt bei jedem echten Abruf den gemessenen Status zurück.
- Die Suche zeigt „Kurs verfügbar“ / „Kurs im Tarif gesperrt“ /
  „Kurs ungeprüft“. `unknown` wird nie als verfügbar dargestellt.

**Aktivierungsschritt.** Mit einem Tarif ohne Symbolsperre laufen alle Instrumente
nach dem ersten Abruf automatisch auf `available`. Kein Codeumbau nötig.

---

## BLOCKER-006 — Vercel Hobby erlaubt nur einen Cron-Lauf pro Tag

**Schweregrad:** niedrig, aber ein Deployment-Risiko wenn ignoriert.

Auf dem Hobby-Tarif gilt: Cron-Jobs dürfen nur einmal täglich laufen, häufigere
Ausdrücke lassen das Deployment fehlschlagen. Ausserdem ruft Vercel den Job
irgendwann innerhalb der angegebenen Stunde auf, nicht zur exakten Minute.

**Konsequenz.** Alle Ausdrücke in `vercel.json` sind bewusst simpel täglich.
Der Wochentagsfilter für die Prognoseerzeugung liegt in
`src/lib/forecast-schedule.ts` statt im Cron-Ausdruck. Alle Jobs sind idempotent,
weil ihre Reihenfolge nicht garantiert ist.

**Aktivierungsschritt bei Pro.** Mit einem Pro-Tarif sind beliebige Ausdrücke
und minutengenaue Auslösung möglich. Der Wochentagsfilter kann dann optional
zurück in den Cron-Ausdruck, muss aber nicht — der Code ist die testbarere
Stelle.

---

## BLOCKER-007 — TypeScript 7 wird von typescript-eslint noch nicht unterstützt

**Schweregrad:** mittel — hat die Dependency-Pipeline einen Monat lahmgelegt.

**Nachweis.** `typescript-eslint` deklariert auch in der aktuellsten Version
8.66.0 als Peer:

```
"typescript": ">=4.8.4 <6.1.0"
```

TypeScript stable ist inzwischen **7.0.2**. Dependabot hat es in der
`qa-tooling`-Gruppe hochgezogen, wodurch `npm ci` mit `ERESOLVE` abbrach.
Betroffene Deployments: 27.07., 13.07., 11.07., 10.07. — jeweils nach rund
sechs Sekunden „Command npm ci exited with 1".

**Reproduziert und gegengeprüft** am 2026-08-08 per `npm install --dry-run`:

| Kombination | Ergebnis |
|---|---|
| typescript 7.0.2 + typescript-eslint 8.62.0 | **ERESOLVE**, Abbruch |
| typescript 6.0.3 + eslint 10.8.1 + @eslint/js 10.0.1 + playwright 1.62.0 + vitest 4.1.10 | **602 Pakete, erfolgreich** |

ESLint 10 ist also unproblematisch — `typescript-eslint` akzeptiert
`^8.57.0 || ^9.0.0 || ^10.0.0`. Der einzige Blocker ist TypeScript.

**Was implementiert ist.** In `.github/dependabot.yml`:

- `ignore`-Regel für `typescript >=6.1.0` mit Begründung und Prüfkommando.
- `typescript-eslint` und `@eslint/*` in die `qa-tooling`-Gruppe aufgenommen.
  Sie peeren auf eslint **und** typescript; werden sie getrennt aktualisiert,
  entstehen zwangsläufig unauflösbare Kombinationen. Genau das war die Ursache.

**Aktivierungsschritt.** Sobald typescript-eslint TypeScript 7 unterstützt, die
`ignore`-Regel entfernen. Prüfen mit:

```
npm view typescript-eslint@latest peerDependencies
```

**Nicht getan.** Ich habe TypeScript und ESLint im Projekt **nicht** selbst auf
6.0.3 / 10.8.1 angehoben. Ein TS-Major-Bump kann neue Typfehler erzeugen, und
ich kann `npm run build` in dieser Umgebung nicht ausführen. Das gehört in einen
eigenen, verifizierten Schritt — Dependabot wird es jetzt ohnehin vorschlagen.

---

## BLOCKER-008 — Sicherheitslücken durch die blockierte Update-Pipeline

**Status:** behoben am 2026-08-08. Bleibt als Beleg für die Folgekosten von
BLOCKER-007 dokumentiert.

Der erste CI-Lauf über den Branch scheiterte am Schritt `Dependency audit`:
**14 Schwachstellen, 8 moderate und 6 hohe.** Alle acht Qualitäts-Gates davor
waren grün.

Das ist die direkte Folge davon, dass Dependabot seit dem 10.07. nicht mehr
durchlief. Sicherheitsupdates konnten einen Monat lang nicht landen.

Betroffen waren unter anderem:

| Paket | Schwere | Problem |
|---|---|---|
| next 16.2.9 | hoch | SSRF in Rewrites, DoS in der Image-API, unauthentifizierte Offenlegung interner Server-Function-Endpunkte |
| postcss 8.5.15 | hoch | Path Traversal über `sourceMappingURL` |
| sharp | hoch | libvips-CVEs |
| brace-expansion, js-yaml, tar | hoch/moderat | DoS |

**Eine Ursache lag im eigenen Repo.** Der `overrides`-Block in `package.json`
pinnte `postcss` fest auf `8.5.15` — genau die verwundbare Version. Der Pin hat
das Update aktiv verhindert.

**Behebung:** `next` und `eslint-config-next` auf 16.3.0, `postcss` und der
Override auf 8.5.26, Rest über `npm audit fix` ohne `--force`.

Ergebnis: **0 Schwachstellen.** Alle neun Gates verifiziert.

---

## BLOCKER-002 — Keine Realtime-Marktdatenlizenz

**Schweregrad:** mittel

Der aktive FMP-Tarif liefert `delayed`-Daten (`FMP_DATA_QUALITY=delayed` in der
Konfiguration). Echtzeitanzeige erfordert Börsenlizenzen und explizite
Anzeigerechte.

**Konsequenz.** Die App darf nirgends „Live" anzeigen. Die vorhandene
Qualitätskennzeichnung (`realtime` / `near_realtime` / `delayed` / `historical` /
`mock` / `unavailable`) ist implementiert und muss so bleiben.

---

## BLOCKER-003 — pgTAP-Suiten — GELÖST

**Status:** erledigt am 2026-08-08. Database Tests Run #20 auf Commit `91b0880`:
**Success in 2m 19s**, alle fünf Suiten grün.

Der Blocker war nie „pgTAP geht nicht", sondern „pgTAP lief nie" — und deshalb
lagen zwei Fehler seit Monaten unentdeckt in `forecast_ledger_controls`
(Vier-Argument-`has_table_privilege`, `plan(24)` bei 26 Assertions).

Aktueller Stand der Suiten:

| Datei | Assertions |
|---|---|
| `billing_controls.test.sql` | 15 |
| `forecast_ledger_controls.test.sql` | 26 |
| `institutional_controls.test.sql` | 25 |
| `instrument_master_controls.test.sql` | 24 |
| `rls_and_integrity.test.sql` | 13 |

**Weiterhin gilt:** lokal ausführbar nur mit Docker. Wer keine lokale Instanz
hat, verlässt sich auf CI — der Workflow `database-tests.yml` läuft bei jedem
Pull Request. Die zwei Fallen beim Schreiben neuer Suiten stehen in `AGENTS.md`.

---

## BLOCKER-004 — Kein Apple-Developer-Zugang

**Schweregrad:** niedrig, blockiert nur den Store-Release

Der Capacitor-/iOS-Build wurde nie auf Apple-Seite gebaut. Ohne
Developer-Account ist weder Signierung noch Einreichung möglich.

---

## BLOCKER-009 — Vollstaendige Realtime-Abdeckung und Anzeige-Lizenzen

**Schweregrad:** hoch fuer das Ziel einer globalen professionellen Plattform.

Die Provider-Schicht kann technische Realtime-, Near-Realtime-, Delayed- und
Historical-Daten normalisieren. Ob ein Kurs gespeichert, weitergegeben und in
einer Endkunden-App angezeigt werden darf, entscheidet jedoch der konkrete
Provider- und Boersentarif. Diese Rechte koennen nicht durch Code ersetzt
werden.

**Aktivierungsschritt.** Gewuenschte Handelsplaetze und Assetklassen festlegen,
Anbieterangebote inklusive Display-, Redistribution- und Derived-Data-Rechten
rechtlich pruefen und erst danach die jeweilige Produktionskonfiguration
aktivieren.

---

## BLOCKER-010 — Shared Cache fuer horizontale Skalierung

**Schweregrad:** mittel.

Ohne `UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN` faellt die App
bewusst auf einen lokalen Prozesscache zurueck. Das ist funktional, aber bei
mehreren Vercel-Instanzen weder ein global konsistentes Rate-Limit noch ein
gemeinsamer Provider-Cache.

**Aktivierungsschritt.** Eine dedizierte Redis-/Upstash-Instanz fuer StockPilot
bereitstellen, beide Server-Variablen in Preview und Produktion setzen und den
Health-Status `sharedConfigured: true` pruefen.

---

## BLOCKER-011 — Kommerzielle Rechtsfreigabe

**Schweregrad:** hoch vor dem Verkauf an Verbraucher.

Der technische Disclaimer ersetzt keine rechtlich geprueften AGB,
Widerrufsbelehrung, Datenschutzpruefung und Datenlizenzmatrix. Inhalte und
Preise duerfen erst nach Freigabe durch qualifizierte Rechtsberatung als
kommerziell produktionsbereit bezeichnet werden.

## BLOCKER-012 - Schutz gegen geleakte Passwörter deaktiviert

**Status:** `BLOCKED - EXTERNAL CONFIGURATION`

**Nachweis (2026-08-11):** Der Supabase Security Advisor für das
Produktionsprojekt `STAI` meldet `auth_leaked_password_protection` als
Warnung. StockPilot bietet Passwortregistrierung und Passwortlogin an, daher ist
der Befund relevant.

**Auswirkung:** Bekannte kompromittierte Passwörter werden von Supabase Auth
derzeit nicht automatisch abgewiesen. Die App darf diesen Schutz nicht als aktiv
darstellen.

**Aktivierung:** In den Supabase-Auth-Einstellungen "Leaked password
protection" aktivieren. Laut offizieller Supabase-Dokumentation ist diese
Funktion im Pro-Tarif und höher verfügbar. Danach Security Advisor erneut
ausführen und den Befund erst bei leerem Ergebnis schließen.

**Unabhängig im Code fortsetzbar:** Mindestlänge und Passwortregeln können
gehärtet sowie verständliche Fehlerzustände getestet werden.

### Ergänzung zu BLOCKER-012 vom 2026-08-11

Der Anwendungscode und die versionierte lokale Supabase-Konfiguration sind auf mindestens 10 Zeichen, Bestätigung beim Reset und secure_password_change gehärtet. Der lokale Drift-Test ist grün.

Nicht als erledigt gemeldet:
- Die Supabase-CLI besitzt auf diesem Rechner keinen Management-Zugang.
- Ein vollständiges config push wäre wegen weiterer lokaler Einstellungen, insbesondere lokaler URLs, zu breit und wurde bewusst nicht ausgeführt.
- Die produktiven Auth-Schalter müssen gezielt im Supabase-Dashboard oder über einen eng begrenzten Management-API-Zugang gesetzt und danach erneut geprüft werden.
- Leaked-Password-Protection bleibt tarifabhängig und laut Supabase erst ab Pro verfügbar.

Offizielle Anleitung: https://supabase.com/docs/guides/auth/password-security

### Ergänzung zu FMP-Instrument-/Tarifgrenzen vom 2026-08-12

**Status:** `BLOCKED – EXTERNAL`

Beim finalen Produktionsnachweis des kanonischen Bar-Modells antwortete AAPL mit
HTTP 403 und `quote_not_entitled`. SPY, MSFT und NVDA antworteten fail-closed mit
HTTP 503 und `identity_unverified`. Das suchgetriebene Instrumentuniversum
enthielt zu diesem Zeitpunkt kein als `available` bestätigtes FMP-Symbol.

Damit sind Deployment, API-Fehlerzustände und das Zurückhalten von Analysen real
belegt. Ein finaler Live-Inhaltstest echter Providerbars ist jedoch erst möglich,
wenn ein Produktionsprovider für dasselbe Instrument Identität, Quote und
Historie freigibt.

**Aktivierungsschritt:** FMP-Tarif mit symbolübergreifend nutzbaren Quotes und
historischen Tagesdaten freischalten oder in Phase 3 einen lizenzierten Provider
für Quote und Historie routen. Danach ein Instrument im Instrument Master als
`available` messen und den Live-Test für Identität, Währung, OHLCV, Intervall,
Adjustment-Art und Analysis Gate wiederholen.

## Externe Darstellungsrechte der Datenprovider (Phase 3, 2026-08-12)

**Status:** BLOCKED – EXTERNAL, technisch fail-closed.

Die vorhandenen API-Schlüssel belegen keine öffentliche Anzeige-,
Weiterverteilungs- oder Realtime-Lizenz. Deshalb sind externe Providerdaten in
Preview und Produktion gesperrt, bis der konkrete Vertrag/Tarif geprüft und
dokumentiert ist. Das gilt aktuell auch für offizielle Quellen wie SEC EDGAR,
FRED und EZB; öffentlich zugänglich bedeutet nicht automatisch, dass jede Form
der Weitergabe ohne Prüfung zulässig ist.

Aktivierung erst nach Rechteprüfung:

1. Vertrag/Tarif und Attributionspflicht je Provider dokumentieren.
2. Provider in `MARKET_DATA_LICENSE_VERIFIED_PROVIDERS` aufnehmen.
3. Nur für tatsächlich erlaubte Endnutzeranzeige zusätzlich in
   `MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS` aufnehmen.
4. `MARKET_DATA_LICENSE_VERIFIED_AT` setzen.
5. Erst danach `MARKET_DATA_ALLOW_EXTERNAL_DISPLAY=true` setzen.
6. Produktions- und Live-Smoke-Test mit Provider-, Qualitäts- und
   Zeitstempelanzeige wiederholen.

Bis dahin liefert StockPilot keine erfundenen Ersatzwerte: Quotes/News melden
`unavailable`; SEC/EZB/FRED antworten mit explizitem 503-Rechtehinweis.

## Phase-4-Ergänzung zu BLOCKER-010 vom 2026-08-12

Die Anwendungsschicht ist vollständig vorbereitet und produktiv belegt:
atomare Zähler, Request-Coalescing, besitzersichere verteilte Sperren,
providerbezogene Budgets, Circuit-Zustände und Upstash-Timeouts sind
implementiert. Ohne konfigurierte `UPSTASH_REDIS_REST_URL` und
`UPSTASH_REDIS_REST_TOKEN` meldet Health weiterhin
`sharedConfigured: false`; mehrere Vercel-Instanzen koordinieren dann nicht
global. Dieser externe Infrastrukturpunkt bleibt deshalb offen und wird nicht
als horizontal abgeschlossen bezeichnet.

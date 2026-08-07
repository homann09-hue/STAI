# Externe Blocker

Dieses Dokument listet ausschließlich Blocker, die **nicht durch Code lösbar** sind.
Jeder Eintrag nennt den Nachweis, die betroffene Funktion und die konkreten
Aktivierungsschritte.

Letzte Verifikation: 2026-08-07

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

## BLOCKER-002 — Keine Realtime-Marktdatenlizenz

**Schweregrad:** mittel

Der aktive FMP-Tarif liefert `delayed`-Daten (`FMP_DATA_QUALITY=delayed` in der
Konfiguration). Echtzeitanzeige erfordert Börsenlizenzen und explizite
Anzeigerechte.

**Konsequenz.** Die App darf nirgends „Live" anzeigen. Die vorhandene
Qualitätskennzeichnung (`realtime` / `near_realtime` / `delayed` / `historical` /
`mock` / `unavailable`) ist implementiert und muss so bleiben.

---

## BLOCKER-003 — pgTAP-Suiten nicht ausgeführt

**Schweregrad:** mittel

`npx supabase test db` benötigt eine lokale Postgres-/Supabase-Instanz. Zuletzt
gescheitert am 2026-08-06 mit `LegacyDbConnectError`.

**Ersatznachweis.** Die RLS-Isolation wurde am 2026-08-07 stattdessen direkt
gegen die Produktionsdatenbank verifiziert — in einer Transaktion mit Rollback,
mit zwei Testnutzern, ohne Rückstände. Ergebnis: Fremdzeilen unsichtbar,
`billing_events` und `forecasts` für `authenticated` gesperrt, Schreibversuch auf
fremde `user_id` blockiert.

**Aktivierungsschritt.** Docker starten, `npx supabase start`, dann
`npm run test:db`.

---

## BLOCKER-004 — Kein Apple-Developer-Zugang

**Schweregrad:** niedrig, blockiert nur den Store-Release

Der Capacitor-/iOS-Build wurde nie auf Apple-Seite gebaut. Ohne
Developer-Account ist weder Signierung noch Einreichung möglich.

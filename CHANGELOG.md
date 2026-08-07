# Changelog

Alle wesentlichen Produkt-, Sicherheits- und Architekturänderungen werden hier dokumentiert.

## 2026-08-07

### Security

- Nutzerdaten laufen nicht mehr über den Service-Role-Client. `getSupabaseAuth`
  liefert jetzt einen an das Access Token gebundenen Client, sodass Row Level
  Security die Mandantentrennung erzwingt statt der `.eq("user_id", …)`-Filter
  im Anwendungscode. Ein vergessener Filter führt damit zu einem leeren
  Ergebnis statt zu einem Cross-Tenant-Leak.
- Der Service-Role-Client bleibt bewusst nur auf drei privilegierten Pfaden:
  `apply_portfolio_trade` (nur `service_role` hat execute), DSGVO-Export (liest
  `billing_events`, das `authenticated` verweigert) und Admin-Kontolöschung.
- Kein stiller Rückfall auf den Service-Client, wenn der nutzergebundene Client
  nicht erzeugt werden kann. Stattdessen `missing_client` plus Log-Event.
- Rate-Limit-Schlüssel nimmt aus `x-forwarded-for` den ersten Eintrag (Client)
  statt des letzten (Proxy). Der letzte Eintrag ist für alle Nutzer identisch
  und machte den Limiter in dieser Kette wirkungslos.
- `env.ts` validiert jetzt auch Provider-, Stripe-, Cron- und Supabase-Secrets,
  die bisher ungeprüft am Zod-Schema vorbeiliefen.

### Fixed

- DSGVO-Export scheitert nicht mehr vollständig, wenn eine Tabelle aus
  `personalDataTables` in der Datenbank fehlt. `/api/account/export` antwortete
  in Produktion mit 500, weil `billing_events` mangels angewandter Migration
  nicht existierte. Der Export liefert jetzt die verfügbaren Daten plus
  `unavailableTables` und `complete: false`.

### Infrastructure

- Migrationen `20260711010000_add_saas_billing_controls` und
  `20260806175532_add_forecast_ledger_controls` auf das Produktionsprojekt
  angewendet. Beide lagen seit dem jeweiligen Commit nur im Repo vor. Damit
  existieren `billing_events`, `model_registry`, `forecasts`,
  `forecast_outcomes` und `model_evaluations` samt Immutability-Triggern und
  Plan-Limit-Triggern erstmals in der Datenbank.

### Changed

- Coverage misst mit `all: true` die gesamte Codebasis. Bisher zählte v8 nur
  von Tests importierte Dateien: 26 von rund 200 Quelldateien, gemeldet als
  88 %. Die Schwellen sind vorläufig auf eine niedrige, ehrliche Untergrenze
  gesetzt und müssen nach dem ersten vollständigen Lauf kalibriert werden.
- `tsconfig` Target von ES2017 auf ES2022 angehoben.
- `engines.node` wieder auf `>=22 <25` geweitet.
- `lint` prüft wieder das gesamte Projekt (`eslint .`) statt einer Pfadliste,
  die unter anderem `supabase/` ausließ.

### Added

- `createSupabaseUserClient()` in `src/lib/supabase/server.ts`.
- `src/lib/supabase/server.test.ts` sichert die Trennung von nutzergebundenem
  und Service-Client ab, inklusive Host- und Schlüsselvalidierung.
- `tests/stubs/server-only.ts` als Vitest-Alias, damit servergebundene Module
  überhaupt testbar sind.

## 2026-07-11

### Added

- Fail-closed Stripe Checkout und Customer Portal hinter Supabase Auth.
- Signaturgeprüfter Raw-Body-Webhook mit idempotentem, unveränderlichem Billing-Nachweis.
- Serverseitige Entitlement-Auflösung und atomare Planlimits für Watchlists, Alerts und Portfolio-Books.
- Dynamischer, verifizierter Planstatus in Pricing und App-Shell.
- Billing-ADR, Betriebsanleitung, Unit-, E2E- und pgTAP-Tests.

### Security

- Keine Stripe-Secrets oder Provider-IDs im Client.
- Keine Freischaltung durch Clientwerte oder ungeprüfte Metadaten.
- Sichere Stripe-Redirect-Allowlist und fail-closed Fehlerzustände.

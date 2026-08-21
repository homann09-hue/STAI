# StockPilot AI Status

Stand: 2026-08-21

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfte Branchbasis: `main` bei `35ea0e716bf27e6e767f02dcb171c5e5bfcf68c9`
- Aktive Phase: **Phase 1.3 – Payment-Recovery und Doppelabo-Schutz**
- Arbeitsbranch: `codex/phase-1-3-payment-recovery`
- Code-Commit: `9448bdb`
- Pull Request: [#105](https://github.com/homann09-hue/STAI/pull/105)
- Freigabestatus: **OPEN**, Pflicht-CI und Merge stehen noch aus

## Abgeschlossene Stabilisierung

- Phase 0: Governance und belegbarer Ist-Stand
- Phase 1.1: Stripe-sichere Kontolöschung, intern abgeschlossen; Produktionsabnahme extern blockiert
- Phase 1.2: Einheitlicher Free/Pro/Premium-Limitvertrag, auf `main` gemergt; Produktionsmigration extern blockiert

## Aktueller Arbeitspunkt

Phase 1.3 verhindert neue Stripe-Checkouts bei bestehenden nichtterminalen Subscriptions. `active`, `trialing`, `past_due`, `unpaid`, `incomplete`, `paused` und unbekannte Providerzustände führen ins Portal oder blockieren bei mehrdeutiger Customer-Lage. Nur `canceled` und `incomplete_expired` erlauben einen neuen Checkout. Aktive manuelle Freischaltungen werden ebenfalls nicht doppelt verkauft.

## Aktuelle Evidenz

- Vitest: 163 Dateien, 1.257 Tests bestanden
- pgTAP nach frischem DB-Reset: 12 Dateien, 300 Assertions bestanden
- Billing-Playwright: Pixel 7 und Desktop Chrome, 2/2 bestanden
- Kritische Phase-1.3-Coverage: 99,28 % Lines, 94,39 % Branches, 100 % Functions
- Gesamtcoverage: 49,80 % Statements, 46,83 % Branches, 48,42 % Functions, 51,72 % Lines
- Format, Typecheck, ESLint, Next-Produktionsbuild und Dependency-Audit bestanden
- `npm audit`: 0 bekannte Schwachstellen
- License-Audit: indirekte `sharp/libvips`-LGPL-Pakete bleiben prüfpflichtig

## Production

`https://stockpilot-ai-beta.vercel.app/api/health` antwortete am 2026-08-21 mit HTTP 200. Das beweist nur Liveness, nicht die Aktivierung von Phase 1.2 oder 1.3. Es wurde in diesem Arbeitspunkt kein Production-Deployment ausgelöst.

## BLOCKED – EXTERNAL

- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte Produktionsprüfung sind nicht möglich.
- Vollständiger Stripe-Testmode-Lifecycle mit echten Test-Customer, Test-Subscription, Portal und Webhooks bleibt bis zur verfügbaren externen Billing-/Supabase-Infrastruktur offen.
- Billing bleibt deaktiviert. Keine Paid-Aktivierung vor Abschluss von Phase 1.5.

## Nächster zulässiger Schritt

PR #105 vollständig durch CI, Datenbank-CI und StockPilot-Preview führen, Fehler beheben und geschützt mergen. Phase 1.4 beginnt erst danach. BauPro und andere Projekte bleiben unberührt.

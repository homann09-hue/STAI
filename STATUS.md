# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfte Branchbasis: `main` bei `db5ef697a10f27d1c8b022c9ce123cccdab2d24e`
- Aktive Phase: **Phase 1.3 – Payment-Recovery und Doppelabo-Schutz**
- Arbeitsbranch: `codex/phase-1-3-evidence`
- Merge-Commit: `db5ef697a10f27d1c8b022c9ce123cccdab2d24e`
- Pull Request: [#105](https://github.com/homann09-hue/STAI/pull/105)
- Freigabestatus: **TECHNISCH ABGESCHLOSSEN – EXTERN BLOCKIERT**

## Abgeschlossene Stabilisierung

- Phase 0: Governance und belegbarer Ist-Stand
- Phase 1.1: Stripe-sichere Kontolöschung, intern abgeschlossen; Produktionsabnahme extern blockiert
- Phase 1.2: Einheitlicher Free/Pro/Premium-Limitvertrag, auf `main` gemergt; Produktionsmigration extern blockiert
- Phase 1.3: Payment-Recovery und Doppelabo-Schutz, auf `main` gemergt; echter Stripe-Testmode-Lifecycle extern blockiert

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
- PR #105: Code-CI, pgTAP und Vercel-Preview grün; Supabase-Preview wegen inaktivem Produktionsprojekt erwartungsgemäß übersprungen
- Datenbankschema: unverändert, keine Migration für Phase 1.3 erforderlich

## Production

`https://stockpilot-ai-beta.vercel.app/api/health` antwortete am 2026-08-21 mit HTTP 200. Das beweist nur Liveness, nicht die Aktivierung von Phase 1.2 oder 1.3. Es wurde in diesem Arbeitspunkt kein Production-Deployment ausgelöst.

## BLOCKED – EXTERNAL

- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte Produktionsprüfung sind nicht möglich.
- Vollständiger Stripe-Testmode-Lifecycle mit echten Test-Customer, Test-Subscription, Portal und Webhooks bleibt bis zur verfügbaren externen Billing-/Supabase-Infrastruktur offen.
- Billing bleibt deaktiviert. Keine Paid-Aktivierung vor Abschluss von Phase 1.5.

## Nächster zulässiger Schritt

Den dokumentarischen Abschluss von Phase 1.3 geschützt mergen. Danach darf Phase 1.4 zur atomaren und reihenfolgeunabhängigen Webhook-Verarbeitung beginnen. BauPro und andere Projekte bleiben unberührt.

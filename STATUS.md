# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfte Branchbasis: `main` bei `f44364678b6386bb3014fe16e6d4f06b361ceb33`
- Aktive Phase: **Phase 1.4 – atomare und reihenfolgeunabhängige Stripe-Webhooks**
- Arbeitsbranch: `codex/phase-1-4-webhook-ordering`
- Code-Commit: `2fd58bf`
- Pull Request: [#107](https://github.com/homann09-hue/STAI/pull/107)
- Freigabestatus: **OPEN**

## Abgeschlossene Stabilisierung

- Phase 0: Governance und belegbarer Ist-Stand
- Phase 1.1: Stripe-sichere Kontolöschung, intern abgeschlossen; Produktionsabnahme extern blockiert
- Phase 1.2: Einheitlicher Free/Pro/Premium-Limitvertrag, auf `main` gemergt; Produktionsmigration extern blockiert
- Phase 1.3: Payment-Recovery und Doppelabo-Schutz, auf `main` gemergt; echter Stripe-Testmode-Lifecycle extern blockiert

## Aktueller Arbeitspunkt

Phase 1.4 ersetzt getrennte Webhook-Schreibvorgänge durch eine einzige service-role-gebundene PostgreSQL-RPC. Event-Ledger und Entitlement-Mutation committen oder rollen gemeinsam zurück. Ein kurzer Transaktions-Lock serialisiert Events je Nutzer. Neuere Providerzeit gewinnt; bei identischer Zeit entscheidet die Event-ID deterministisch. Duplikate und veraltete Events bleiben nachvollziehbar, wirken aber nicht erneut. Unbekannte Stripe-Price-IDs fallen nicht mehr auf änderbare Metadaten zurück.

## Aktuelle Evidenz

- Geprüfter Ausgangsstand: Main-Code-CI und Main-Datenbank-CI grün
- Vollständige Vitest-Coverage-Suite: 163 Dateien, 1.265/1.265 Tests bestanden
- Fokussierte Webhook-/Normalisierungs-Suite: 2 Dateien, 29/29 Tests bestanden
- Frischer lokaler Supabase-Reset: erfolgreich
- pgTAP: 13 Dateien, 327/327 Assertions bestanden
- Reale lokale PostgREST-Concurrency: 64 absichtlich ungeordnete Events und 100 parallele Duplikate bestanden
- Kritische Coverage: 100 % Lines, 91,97 % Branches, 100 % Functions
- Gesamtcoverage: 49,84 % Statements, 47,02 % Branches, 48,50 % Functions, 51,75 % Lines
- Format, Typecheck, ESLint, lokaler Supabase-Schemalint und Next-Production-Build mit 35 Seiten bestanden
- Billing-Playwright: Mobile Chrome und Desktop Chrome, 2/2 bestanden
- `npm audit`: 0 bekannte Schwachstellen; License-Audit bestanden, indirekte `sharp/libvips`-LGPL-Pakete bleiben prüfpflichtig

## Production

`https://stockpilot-ai-beta.vercel.app/api/health` antwortete am 2026-08-22 mit HTTP 200. Das beweist nur Liveness. Phase 1.4 ist weder in Production migriert noch deployt oder live geprüft.

## BLOCKED – EXTERNAL

- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte Produktionsprüfung sind nicht möglich.
- Vollständiger Stripe-Testmode-Lifecycle mit echten Test-Customer, Test-Subscription, Portal und Webhooks bleibt bis zur verfügbaren externen Billing-/Supabase-Infrastruktur offen.
- Billing bleibt deaktiviert. Keine Paid-Aktivierung vor Abschluss von Phase 1.5.

## Nächster zulässiger Schritt

Sämtliche Pflicht-CI-, Datenbank- und StockPilot-Preview-Checks von PR #107 abwarten, Befunde beheben und geschützt mergen. Phase 1.5 beginnt erst danach. BauPro und andere Projekte bleiben unberührt.

# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfte Branchbasis: `main` bei `2ff1ef09edb8b1f8f960c846483203586e170bdd`
- Aktive Phase: **Phase 1.5 – vollständige Stripe-Testmode-E2E-Kette**
- Arbeitsbranch: `codex/phase-1-5-stripe-testmode`
- Freigabestatus: **IN ARBEIT – TESTMODE-SECRET EXTERN AUSSTEHEND**

## Abgeschlossene Stabilisierung

- Phase 0: Governance und belegbarer Ist-Stand
- Phase 1.1: Stripe-sichere Kontolöschung, intern abgeschlossen; Produktionsabnahme extern blockiert
- Phase 1.2: Einheitlicher Free/Pro/Premium-Limitvertrag, auf `main` gemergt; Produktionsmigration extern blockiert
- Phase 1.3: Payment-Recovery und Doppelabo-Schutz, auf `main` gemergt; echter Stripe-Testmode-Lifecycle extern blockiert

## Aktueller Arbeitspunkt

Phase 1.5 ergänzt einen strikt lokalen Stripe-Testmode-Harness. Er erzeugt temporäre Testressourcen, prüft Checkout, signierte Webhooks, aktiven Zugriff, Portal, `past_due`, Wiederherstellung, Kündigung, Duplikate und erneuten Checkout und räumt anschließend auf. Live-Schlüssel, Remote-App-URLs, Remote-Supabase-URLs und Liveobjekte werden technisch abgewiesen. Ein manueller GitHub-Workflow kapselt den Lauf in einer geschützten `stripe-testmode`-Environment.

Der Harness umfasst außerdem die Kontolöschung mit aktivem Testabo: offene Checkout-Sessions und das Abo müssen beendet, die Supabase-Identität gelöscht, die Saga abgeschlossen und ein verspäteter aktiver Webhook ohne Entitlement-Wiederbelebung protokolliert werden.

## Phase-1.5-Evidenz

- Sicherheitsvertrag des Harness: 6/6 Tests bestanden
- Vollständige Vitest-Suite: 164 Dateien, 1.271/1.271 Tests bestanden
- Gesamtcoverage: 49,84 % Statements, 47,02 % Branches, 48,50 % Functions, 51,75 % Lines
- Format, Governance, Typecheck, ESLint und Next-Production-Build mit 35 Seiten bestanden
- Fail-closed-Probe: fehlender Testmode-Key wurde vor jedem Provideraufruf abgewiesen
- `npm audit`: 0 bekannte Schwachstellen; Lizenzprüfung bestanden mit der bekannten indirekten `sharp/libvips`-Prüfliste
- Echter Stripe-Testmode-Lifecycle: **NICHT GELAUFEN**, weil kein StockPilot-Testmode-Key verfügbar ist
- Stripe CLI 1.50.4 installiert; automatische isolierte Sandbox vom Provider nicht provisioniert, Browser-/Kontofreigabe erforderlich

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
- PR #107: Code-CI, Datenbank-CI mit Concurrency-Gate und StockPilot-Vercel-Preview grün

## Production

`https://stockpilot-ai-beta.vercel.app/api/health` antwortete am 2026-08-22 mit HTTP 200. Das beweist nur Liveness. Phase 1.4 ist weder in Production migriert noch deployt oder live geprüft.

## BLOCKED – EXTERNAL

- Supabase-Projekt `STAI` ist `INACTIVE`; Remote-Migration und authentifizierte Produktionsprüfung sind nicht möglich. Der Phase-1.5-Harness verwendet deshalb ausschließlich lokale Supabase-Infrastruktur.
- Der einzige verbundene Stripe-Zugang ist `Ovora` im Live-Modus und wurde nicht verwendet. Ein isolierter StockPilot-Testmode-Key fehlt noch.
- Billing bleibt deaktiviert. Keine Paid-Aktivierung vor Abschluss von Phase 1.5.

## Nächster zulässiger Schritt

Einen StockPilot-Testmode-Key ausschließlich in der geschützten GitHub-Environment hinterlegen und den manuellen Lifecycle belegen. Keine Live-Aktivierung; BauPro und andere Projekte bleiben unberührt.

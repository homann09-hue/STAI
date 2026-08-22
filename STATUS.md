# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfter Code-Stand: `main` bei `04f8ab162c2c1719a6241a60a5642a5a20e464bb`
- Aktive Phase: **Phase 1.5 – vollständige Stripe-Testmode-E2E-Kette**
- Aktiver Arbeitsstatus: isolierte Stripe-Sandboxfreigabe ausstehend
- Freigabestatus: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**

## Abgeschlossene Stabilisierung

- Phase 0: Governance und belegbarer Ist-Stand
- Phase 1.1: Stripe-sichere Kontolöschung, intern abgeschlossen; Produktionsabnahme extern blockiert
- Phase 1.2: Einheitlicher Free/Pro/Premium-Limitvertrag, auf `main` gemergt; Produktionsmigration extern blockiert
- Phase 1.3: Payment-Recovery und Doppelabo-Schutz, auf `main` gemergt; echter Stripe-Testmode-Lifecycle extern blockiert

## Aktueller Arbeitspunkt

Phase 1.5 ergänzt einen strikt lokalen Stripe-Testmode-Harness. Er erzeugt temporäre Testressourcen, prüft Checkout, signierte Webhooks, aktiven Zugriff, Portal, `past_due`, Wiederherstellung, Kündigung, Duplikate und erneuten Checkout und räumt anschließend auf. Live-Schlüssel, Remote-App-URLs, Remote-Supabase-URLs und Liveobjekte werden technisch abgewiesen. Ein manueller GitHub-Workflow kapselt den Lauf in einer geschützten `stripe-testmode`-Environment.

Der Harness umfasst außerdem die Kontolöschung mit aktivem Testabo: offene Checkout-Sessions und das Abo müssen beendet, die Supabase-Identität gelöscht, die Saga abgeschlossen und ein verspäteter aktiver Webhook ohne Entitlement-Wiederbelebung protokolliert werden.

Payment-Recovery verwendet im ausführbaren Sandboxvertrag eine echte Stripe Test Clock: `pm_card_chargeCustomerFail` erzeugt den Providerstatus `past_due`; nach Zahlung der offenen Rechnung mit `pm_card_visa` muss Stripe wieder `active` liefern. Erst diese realen Providerobjekte werden signiert an die lokale Webhook-Route übergeben.

## Phase-1.5-Evidenz

- Sicherheitsvertrag des Harness einschließlich Key-, Ziel- und Permission-Grenzen bestanden
- Vollständige Vitest-Suite: 165 Dateien, 1.298/1.298 Tests bestanden
- Gesamtcoverage: 49,84 % Statements, 47,02 % Branches, 48,50 % Functions, 51,75 % Lines
- Format, Governance, Typecheck, ESLint und Next-Production-Build mit 35 Seiten bestanden
- Fail-closed-Probe: fehlender Testmode-Key wurde vor jedem Provideraufruf abgewiesen
- `npm audit`: 0 bekannte Schwachstellen; Lizenzprüfung bestanden mit der bekannten indirekten `sharp/libvips`-Prüfliste
- Echter Stripe-Testmode-Lifecycle lief auf `main` bis zum Test-Clock-Endpunkt: Checkout, Portal, Entitlements, Recovery-Gate, Kündigung, Duplicate-Webhook, Kontolöschung, Checkout-Expiry und Late-Webhook-Isolation wurden gegen echte Stripe-Testobjekte und lokale Supabase-Daten geprüft
- GitHub-Lauf `32554651375` belegt den verbleibenden Providerblocker: der isolierte `rkcs_test_`-Schlüssel verweigert ausschließlich Test Clocks mit HTTP 403
- Die zuvor sichtbare Profilbereitstellungswarnung ist nach PR #117 im Wiederholungslauf verschwunden

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
- Der Live-Zugang `Ovora` wurde nicht verwendet. Die isolierte StockPilot-Sandbox besitzt nur einen eingeschränkten Claimable-Key; Test Clocks benötigen nach der Kontozuordnung einen vollständigen Testmode-Key.
- Billing bleibt deaktiviert. Keine Paid-Aktivierung vor Abschluss von Phase 1.5.

## Nächster zulässiger Schritt

Die isolierte Sandbox nach ausdrücklicher Kontoinhaberbestätigung beanspruchen, den vollständigen Testmode-Key ausschließlich in der geschützten GitHub-Environment ersetzen und Lauf `Stripe Testmode E2E` vollständig grün belegen. Keine Live-Aktivierung; BauPro und andere Projekte bleiben unberührt.

# StockPilot AI Operating Card

Stand: 2026-08-21
Status: **OPEN**
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md` (Version 4.0)

<!-- ACTIVE_WORKPOINT: PHASE-1-1-ACCOUNT-DELETION -->

## Produktauftrag

StockPilot AI wird als ehrliche, sichere und skalierbare Multi-Asset-Research-
Plattform aufgebaut. Datenqualität, Quelle, Zeitstempel, Lizenzstatus und
Unsicherheit müssen bis zur Nutzeroberfläche nachvollziehbar bleiben. Die App
gibt keine garantierten Prognosen und keine Anlageberatung aus.

## Aktiver Arbeitspunkt

**Phase 1.1 – Stripe-sichere Account-Löschung.** Vor der Identitätslöschung
werden frische Re-Authentifizierung, alle zugeordneten Stripe-Subscriptions,
Saga-/Lease-Status, Audit-Trail, Wiederaufnahme und Webhook-Rennen abgesichert.
Billing bleibt bis zum vollständigen Abschluss von Phase 1 deaktiviert.

## Verifizierte Ausgangslage

- Phase 0: PR #99 gemergt
- Phase 1.1: PR #100 gemergt, Main `c1c114105b9e16ab29b620a8ac4b0faf3d4d1e0b`
- Produktion: Deployment `dpl_2ZDn9sQbFaemkmdQmWDszXGMUpaQ`, READY
- Live-Alias: `https://stockpilot-ai-beta.vercel.app`, Root und Health HTTP 200
- Pflichtchecks von PR #99: StockPilot CI, pgTAP und Vercel erfolgreich
- Branch Protection: strict; Pflichtkontexte StockPilot CI, pgTAP und Vercel
- Phase 1.1-Red-Team: PR #101 auf Commit `75d1772` mit App-CI, pgTAP und
  beiden Vercel-Checks grün; Produktionsmigration und Deployment ausstehend

## Lieferregel

Jeder Arbeitspunkt startet vom verifizierten `main` und erhält genau einen
Branch und einen PR. Der nächste Punkt beginnt erst nach grüner CI inklusive
Datenbankprüfung, Merge, StockPilot-Deployment, Sandbox-/Live-Prüfung,
Logprüfung und aktualisierter Evidenz. Gestapelte PRs sind verboten.

## Definition of Done

Code, Migrationen, Tests, exakte Testzahlen, Coverage des kritischen Bereichs,
Build, Security-Prüfung, Commit, Branch, PR, CI-Links, Datenbank-CI, Preview,
Deployment, Live-/Sandbox-Prüfung, Logs, Restpunkte, externe Blocker und
Dokumentation sind belegt. Zulässige Stati sind ausschließlich `OPEN`,
`FAILED`, `TECHNICALLY COMPLETE – BLOCKED EXTERNAL`,
`DEPLOYED – LIVE VERIFICATION PENDING` und `COMPLETE – VERIFIED`.

## Isolation

Es wird ausschließlich das Repository `homann09-hue/STAI` und das Vercel-
Projekt `stockpilot-ai` verändert. BauPro und alle anderen Projekte bleiben
unangetastet.

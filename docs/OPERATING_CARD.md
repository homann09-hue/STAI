# StockPilot AI Operating Card

Stand: 2026-08-21
Status: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**
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
- Phase 1.1: PR #100 und PR #101 gemergt, Main
  `ed2e29edb652e98b7a1a70479d4fbad947bf4da5`
- Produktion: Deployment `dpl_2ZDn9sQbFaemkmdQmWDszXGMUpaQ`, READY
- Live-Alias: `https://stockpilot-ai-beta.vercel.app`, Root und Health HTTP 200
- Pflichtchecks von PR #99: StockPilot CI, pgTAP und Vercel erfolgreich
- Branch Protection: strict; Pflichtkontexte StockPilot CI, pgTAP und Vercel
- Phase 1.1-Red-Team: PR #101 mit App-CI, pgTAP und beiden Vercel-Checks
  gemergt; Produktionsmigration und Deployment ausstehend
- Supabase-Projekt `STAI`: `INACTIVE`; Reaktivierung am Free-Limit von zwei
  anderen aktiven Projekten gescheitert, keines davon wurde verändert

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

## Tarif- und Limitänderungen

1. Werte ausschließlich in `planLimitContract` ändern und Pricing/API daraus ableiten.
2. Eine neue Migration für `private.plan_limit_contract` erstellen; angewendete Migrationen nie nachträglich ändern.
3. Free-, Pro- und Premium-Grenzen jeweils bei Limit minus eins, exakt am Limit und Limit plus eins prüfen.
4. Upgrade und Downgrade prüfen; Downgrades dürfen Daten nicht löschen.
5. `npm test`, `npm run test:db`, Typecheck, Lint und Build vor Freigabe vollständig ausführen.
6. Produktionsstatus erst nach erfolgreicher Remote-Migration und authentifiziertem E2E-Nachweis als aktiv melden.

# StockPilot AI Operating Card

Stand: 2026-08-17
Status: **OPEN**
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md` (Version 4.0)

<!-- ACTIVE_WORKPOINT: PHASE-0-GOVERNANCE-V4 -->

## Produktauftrag

StockPilot AI wird als ehrliche, sichere und skalierbare Multi-Asset-Research-
Plattform aufgebaut. Datenqualität, Quelle, Zeitstempel, Lizenzstatus und
Unsicherheit müssen bis zur Nutzeroberfläche nachvollziehbar bleiben. Die App
gibt keine garantierten Prognosen und keine Anlageberatung aus.

## Aktiver Arbeitspunkt

**Phase 0 – Wahrheit, Governance und stabiler Lieferweg.** Es gibt genau einen
aktiven Arbeitspunkt. Neue Provider, Produktfeatures und die eingefrorene
PR-Kette #87–#97 werden erst nach vollständig grünem, gemergtem, deploytem und
live geprüftem Phase-0-Arbeitspunkt fortgesetzt.

## Verifizierte Ausgangslage

- `main`: `2189a9d2471eb95a40867592a37cd9345390839b`
- Produktion: `https://stockpilot-ai-beta.vercel.app`
- Healthcheck: HTTP 200, `status=ok`, Diagnose geschützt
- Unit-Basis: 152 Dateien / 1.146 Tests erfolgreich
- Browser-Basis: 35 erfolgreich / 1 übersprungen
- Datenbank-CI auf `main`: erfolgreich
- Red-Team: fehlgeschlagen durch künstlichen Client-Socket-Flaschenhals beim
  lokalen 500er Release-Gate; 2.000 Nutzer bleiben verpflichtender,
  nicht-gatender Kapazitäts-Probeumfang
- GitHub-Branch-Protection: wegen wiederholtem GitHub-HTTP-503 noch nicht
  verifiziert

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

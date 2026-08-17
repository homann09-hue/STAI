# StockPilot AI – aktueller Status

Stand: 2026-08-18
Freigabestatus: **OPEN**

## Aktuell

- Autoritative Projektverfassung: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`,
  Version 4.0
- Aktiver Arbeitspunkt: Phase 1.1 – Stripe-sichere Account-Löschung
- Aktiver Branch: `codex/phase-1-1-account-deletion`
- Verifizierter `main`: `9d5f91776c4f197e961037a1dda093aa28f54321`
- Produktion: `https://stockpilot-ai-beta.vercel.app`, Health HTTP 200
- Phase 0: PR #99 gemergt und als StockPilot-Produktion deployt
- Eingefrorene PR-Kette #87–#97: weiterhin vollständig als Entwurf eingefroren
- BauPro und andere Projekte: nicht angefasst

## Letzte belastbare Basis

- Live-Monitoring: erfolgreich, Run 32039456654
- Pull-Request-CI: Run 32040324387 erfolgreich
- Datenbank-CI: 10 Dateien / 224 Assertions erfolgreich, Run 32040324335
- Red-Team: Run 32040526871 erfolgreich
- Phase-1.1 lokal: 157 Dateien / 1.198 Tests erfolgreich
- Phase-1.1 Datenbank: 11 Dateien / 253 Assertions erfolgreich
- Coverage: 48,76 % Statements / 46,17 % Branches / 47,63 % Functions /
  50,60 % Lines
- Browser-E2E: 37 erfolgreich / 1 übersprungen
- 500er Release-Gate: 500/500 HTTP 200, keine Timeouts, p95 6.101 ms
- 2.000 aktive Sessions: 2.000/2.000 HTTP 200, keine Fehler
- 2.000er Sofortspitze: 1.657 HTTP 200 und 343 Timeouts; bewusst nur
  Kapazitätsprobe, kein Release-Gate
- Dependency Audit: 0 bekannte Schwachstellen
- Branch Protection: strict; StockPilot CI, pgTAP und Vercel sind verpflichtend

## Aktuelle Änderung

Phase 1.1 implementiert frische Re-Authentifizierung, Stripe-Kündigung vor
Identitätslöschung, serverseitige Lösch-Saga, Audit-Trail, Webhook-Race-Schutz,
tägliche Wiederaufnahme und zeitlich begrenzte Tombstones. Lokale Voll-Gates,
Build, Datenbanktest und Audits sind grün. PR, CI, Preview, Produktion und der
echte Stripe-Testmode-Durchlauf stehen noch aus.

## Danach

Erst nach grünem PR, Datenbank-CI, Merge, StockPilot-Deployment, Live-/Sandbox-
Prüfung und Logprüfung beginnt Phase 1.2: verbindliche Free-/Pro-/Premium-Limits.

Externe und interne Blocker stehen ausschließlich in `docs/BLOCKERS.md`;
laufende Evidenz ausschließlich in `docs/EXECUTION_LEDGER.md`.

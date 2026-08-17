# StockPilot AI – aktueller Status

Stand: 2026-08-17
Freigabestatus: **OPEN**

## Aktuell

- Autoritative Projektverfassung: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`,
  Version 4.0
- Aktiver Arbeitspunkt: Phase 0 – Wahrheit und Governance
- Aktiver Branch: `codex/phase-0-governance-v4`
- Verifizierter `main`: `2189a9d2471eb95a40867592a37cd9345390839b`
- Produktion: `https://stockpilot-ai-beta.vercel.app`, Health HTTP 200
- Offene PR-Kette #87–#97: vollständig als Entwurf eingefroren
- BauPro und andere Projekte: nicht angefasst

## Letzte belastbare Basis

- StockPilot CI: erfolgreich, Run 31969837599
- Datenbank-CI: erfolgreich, Run 31969837593
- Live-Monitoring: erfolgreich, Run 32039456654
- Unit-Tests: 152 Dateien / 1.146 Tests erfolgreich
- Browser-E2E: 35 erfolgreich / 1 übersprungen
- Red-Team: Run 31993178130 fehlgeschlagen; Ursache war das lokale 500er
  Release-Gate mit nur 256 Client-Sockets, nicht ein belegter Live-Ausfall
- Branch Protection: wegen GitHub-HTTP-503 aktuell nicht verifiziert

## Aktuelle Änderung

Phase 0 konsolidiert die Dokumentationshoheit, erzwingt genau einen aktiven
Arbeitspunkt in CI und korrigiert den künstlichen Client-Flaschenhals im
Stresstest. Die Änderung ist noch nicht gemergt, deployt oder live verifiziert.

## Danach

Erst nach grünem PR, Datenbank-CI, Merge, StockPilot-Deployment, Live-/Sandbox-
Prüfung und Logprüfung beginnt Phase 1.1: Stripe-safe account deletion.

Externe und interne Blocker stehen ausschließlich in `docs/BLOCKERS.md`;
laufende Evidenz ausschließlich in `docs/EXECUTION_LEDGER.md`.

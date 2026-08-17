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

- Live-Monitoring: erfolgreich, Run 32039456654
- Pull-Request-CI: Run 32040324387 erfolgreich
- Datenbank-CI: 10 Dateien / 224 Assertions erfolgreich, Run 32040324335
- Red-Team: Run 32040526871 erfolgreich
- Unit-Tests: 152 Dateien / 1.146 Tests erfolgreich
- Coverage: 47,61 % Statements / 45,29 % Branches / 47,20 % Functions /
  49,41 % Lines
- Browser-E2E: 35 erfolgreich / 1 übersprungen
- 500er Release-Gate: 500/500 HTTP 200, keine Timeouts, p95 6.101 ms
- 2.000 aktive Sessions: 2.000/2.000 HTTP 200, keine Fehler
- 2.000er Sofortspitze: 1.657 HTTP 200 und 343 Timeouts; bewusst nur
  Kapazitätsprobe, kein Release-Gate
- Dependency Audit: 0 bekannte Schwachstellen
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

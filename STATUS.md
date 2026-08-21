# StockPilot AI – aktueller Status

Stand: 2026-08-21
Freigabestatus: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**

## Aktuell

- Autoritative Projektverfassung: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`,
  Version 4.0
- Aktiver Arbeitspunkt: Phase 1.1 – Stripe-sichere Account-Löschung
- Aktiver Branch: `main`; Phase 1.1 wartet auf das Produktionsfenster
- Verifizierter `main`: `ed2e29edb652e98b7a1a70479d4fbad947bf4da5`
- Produktion: `https://stockpilot-ai-beta.vercel.app`, Health HTTP 200
- Supabase-Produktion `STAI`: `INACTIVE`; Reaktivierung durch Free-Tariflimit
  von zwei anderen aktiven Projekten blockiert
- Phase 0: PR #99 gemergt und als StockPilot-Produktion deployt
- Phase 1.1: PR #100 und Red-Team-Härtung PR #101 gemergt
- Eingefrorene PR-Kette #87–#97: weiterhin vollständig als Entwurf eingefroren
- BauPro und andere Projekte: nicht angefasst

## Letzte belastbare Basis

- Live-Monitoring: erfolgreich, Run 32039456654
- Pull-Request-CI: Run 32040324387 erfolgreich
- Datenbank-CI: 10 Dateien / 224 Assertions erfolgreich, Run 32040324335
- Red-Team: Run 32040526871 erfolgreich
- Phase-1.1 lokal: 157 Dateien / 1.198 Tests erfolgreich
- Phase-1.1 Datenbank: 11 Dateien / 253 Assertions erfolgreich
- Phase-1.1 Red-Team: 158 Dateien / 1.207 Tests und 11 pgTAP-Dateien /
  260 Assertions erfolgreich
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

PR #100 ist gemergt. Der anschließende Red-Team-Lauf schließt weitere Rennen:
offene Checkout-Sitzungen werden vor der Identitätslöschung beendet, späte
Subscriptions aktiv gekündigt, gelöschte Nutzer pseudonym erkannt, ungültige
Saga-Sprünge in PostgreSQL verhindert und die 180-Tage-Frist erst ab Abschluss
gestartet. Typecheck, ESLint, 1.207 Tests, 260 pgTAP-Assertions und Build sind
grün. Produktionsmigration, StockPilot-Deployment und echter Stripe-Testmode-
Durchlauf stehen bewusst noch aus. Das native Preview-Deployment ist erfolgreich;
der Runtime-Healthcheck bleibt durch Vercel Deployment Protection geschützt.
Die Reaktivierung von `STAI` scheitert nachweislich am Supabase-Free-Limit;
andere Projekte einschließlich BauPro wurden nicht verändert.

## Danach

Erst nach grünem PR, Datenbank-CI, Merge, StockPilot-Deployment, Live-/Sandbox-
Prüfung und Logprüfung beginnt Phase 1.2: verbindliche Free-/Pro-/Premium-Limits.

Externe und interne Blocker stehen ausschließlich in `docs/BLOCKERS.md`;
laufende Evidenz ausschließlich in `docs/EXECUTION_LEDGER.md`.

## 2026-08-21 — Phase 1.2 Tarif- und Limitvertrag

Status: **TECHNICALLY COMPLETE – BLOCKED EXTERNAL**

- P1 behoben: Free-Watchlist war in PostgreSQL auf 10 statt 15 begrenzt.
- P1 behoben: Premium fiel in `private.current_plan_limit` auf Free-Limits zurück.
- P1 behoben: Der gemeinsame Ressourcen-Trigger griff bei Portfolio-INSERTs auf das nicht vorhandene Feld `NEW.symbol` zu.
- Free/Pro/Premium sind nun in TypeScript, Admin-API, Pricing-UI und PostgreSQL exakt vereinheitlicht.
- Alte aktive Produkttexte `Starter` und `Elite/Business` wurden entfernt; Legacy-Aliase bleiben nur zur Datenkompatibilität.
- Lokal verifiziert: 1.212 Vitest-Tests, 300 pgTAP-Assertions, Typecheck, Lint, Build und `npm audit` grün.
- Coverage-Basis: 49,28 % Statements, 46,41 % Branches, 48,12 % Funktionen, 51,21 % Zeilen.
- Produktion unverändert: Die neue Migration ist wegen des inaktiven Supabase-Projekts noch nicht angewendet; Vercel-Deployment bleibt bewusst zurückgestellt.

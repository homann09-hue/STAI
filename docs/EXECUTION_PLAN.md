# Ausführungsplan

Stand: 2026-08-11
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`

Die Phasen 0 bis 37 und ihre Reihenfolge sind ausschließlich in Abschnitt 77 der
verbindlichen Projektverfassung definiert. Dieses Dokument erzeugt bewusst
keinen zweiten Plan.

## Aktive Phase 0

1. Repository, Architektur, Datenbank, Auth, Provider, Tests, CI, Environment und Live-Stand erfassen.
2. Install, Format, Typecheck, Lint, Unit-/Integrationstests, relevante E2E-Tests und Build ausführen.
3. Kritische vorhandene Fehler zuerst beheben oder mit Nachweis blockieren.
4. Ziel-, Betriebs-, Ledger-, Status- und Blockerdokumentation konsolidieren.
5. Sauber committen, pushen und GitHub-CI inklusive Datenbanktests abwarten.
6. Ausschließlich das Vercel-Projekt `stockpilot-ai` als Preview prüfen und kontrolliert veröffentlichen.
7. Produktion und reale Kernendpunkte prüfen.
8. Ledger aktualisieren und erst danach Phase 1 öffnen.

Der aktuelle tatsächliche Zustand steht nur in `docs/EXECUTION_LEDGER.md`.

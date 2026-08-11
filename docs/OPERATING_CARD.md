# StockPilot AI Operating Card

Stand: 2026-08-11
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar marktreifen Finanzanalyse-Produkt für aktive Anleger und Trader entwickelt. Priorität haben Datenkorrektheit, Stabilität, Sicherheit, tatsächlicher Trader-Mehrwert, Erklärbarkeit, Geschwindigkeit, UX und erst danach Funktionsbreite.

## Aktuelle Phase

**Phase 0: Repository-Bestandsaufnahme und belastbare Baseline.**

Aktiver Abschluss: eine einzige Projektverfassung, ein knapper aktueller Arbeitsstand, belegte lokale Baseline, grünes GitHub-CI, geprüfte Preview/Produktion und aktualisierte Blocker.

## Wichtigste Qualitätsregeln

1. Keine erfundenen Marktdaten, Quellen, Kennzahlen oder Erfolgsmeldungen.
2. Nie `Live` oder `Realtime` anzeigen, wenn Daten delayed, cached, mock, stale oder nicht lizenzgeprüft sind.
3. Keine Analyse veröffentlichen, wenn Instrument, Währung, Aktualität oder erforderliche Eingangsdaten unzureichend sind.
4. Nutzerdaten ausschließlich über den tokengebundenen Supabase-Client und RLS trennen. Service Role nur für die drei in `AGENTS.md` dokumentierten Ausnahmen.
5. Secrets ausschließlich serverseitig. Providerabrufe nur begrenzt, validiert und gegen SSRF geschützt.
6. LLMs interpretieren validierte Evidenz, berechnen aber keine Finanzkennzahlen und erfinden keine Fakten.
7. Ein Arbeitspunkt wird beendet, bevor der nächste beginnt.

## Aktuelle Blocker

- `BLOCKER-001/005`: Der aktive FMP-Tarif liefert kein vollständiges Verzeichnis und schaltet Quotes symbolweise frei.
- `BLOCKER-002/009`: Vollständige Realtime- und Display-Rechte benötigen geeignete Datenverträge.
- `BLOCKER-004`: Native iOS-Veröffentlichung benötigt vollständigen Apple-Developer-Zugang.
- `BLOCKER-006`: Vercel Hobby erlaubt Cron-Jobs nur täglich.
- `BLOCKER-010`: Verteilter Produktionscache fehlt; Instanz-lokaler Cache ist keine belastbare Skalierung.
- `BLOCKER-011`: Kommerzielle Rechts- und Lizenzprüfung ist nicht abgeschlossen.

Details und Nachweise stehen in `docs/BLOCKERS.md`.

## Definition of Done für jeden Arbeitspunkt

Implementierung, Typecheck, Lint, Unit- und Integrationstests, relevante E2E-Tests, Build, Security-Auswirkungen, Mobile/Desktop, Regressionen und Dokumentation sind geprüft. Danach folgen sauberer Commit, GitHub-Push, grünes CI, kontrolliertes Deployment und reale Funktionsprüfung. Externe Hindernisse werden als `BLOCKED - EXTERNAL` dokumentiert.

## Arbeitsregeln

- Zu Aufgabenstart diese Karte und `docs/EXECUTION_LEDGER.md` lesen.
- Vor Änderungen den echten Repository-, CI- und Live-Stand messen.
- Bestehende Architektur erweitern, keine unnötige Parallelarchitektur bauen.
- Provider-Provenance und Datenqualität bis in die UI erhalten.
- BauPro niemals verändern, neu deployen oder mit StockPilot-Artefakten vermischen.
- `STATUS.md`, `docs/EXECUTION_LEDGER.md` und belegte Blocker nach jedem Meilenstein aktualisieren.

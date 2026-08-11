# StockPilot AI Operating Card

Stand: 2026-08-11
Autorität: `docs/ULTIMATE_MARKET_READINESS_GOAL.md`

## Oberstes Produktziel

StockPilot AI wird Phase für Phase zu einem belegbar marktreifen Finanzanalyse-Produkt für aktive Anleger und Trader entwickelt. Priorität haben Datenkorrektheit, Stabilität, Sicherheit, tatsächlicher Trader-Mehrwert, Erklärbarkeit, Geschwindigkeit, UX und erst danach Funktionsbreite.

## Aktuelle Phase

**Phase 1: Bestehende kritische Fehler beheben.**

Aktiver Arbeitspunkt: Der DSGVO-Export wird vollständig an den tokengebundenen RLS-Client gebunden. Billing-Ereignisse werden ausschließlich lesbar und strikt auf `auth.uid()` begrenzt; die Service Role bleibt nur für administrative Kontolöschung.

## Wichtigste Qualitätsregeln

1. Keine erfundenen Marktdaten, Quellen, Kennzahlen oder Erfolgsmeldungen.
2. Nie `Live` oder `Realtime` anzeigen, wenn Daten delayed, cached, mock, stale oder nicht lizenzgeprüft sind.
3. Keine Analyse veröffentlichen, wenn Instrument, Währung, Aktualität oder erforderliche Eingangsdaten unzureichend sind.
4. Nutzerdaten ausschließlich über den tokengebundenen Supabase-Client und RLS trennen. Service Role nur für begründete, dokumentierte Serverpfade.
5. Secrets ausschließlich serverseitig. Providerabrufe nur begrenzt, validiert und gegen SSRF geschützt.
6. LLMs interpretieren validierte Evidenz, berechnen aber keine Finanzkennzahlen und erfinden keine Fakten.
7. Ein Arbeitspunkt wird beendet, bevor der nächste beginnt.

## Aktuelle Blocker

- `BLOCKER-001/005`: Der aktive FMP-Tarif liefert kein vollständiges Verzeichnis und schaltet Quotes symbolweise frei.
- `BLOCKER-002/009`: Vollständige Realtime- und Display-Rechte benötigen geeignete Datenverträge.
- `BLOCKER-004`: Native iOS-Veröffentlichung benötigt vollständigen Apple-Developer-Zugang.
- `BLOCKER-006`: Vercel Hobby erlaubt Cron-Jobs nur täglich.
- `BLOCKER-010`: Verteilter Produktionscache fehlt.
- `BLOCKER-011`: Kommerzielle Rechts- und Lizenzprüfung ist nicht abgeschlossen.
- `BLOCKER-012`: Supabase-Schutz gegen bekannte geleakte Passwörter ist deaktiviert.

Details und Nachweise stehen in `docs/BLOCKERS.md`.

## Definition of Done für jeden Arbeitspunkt

Implementierung, Typecheck, Lint, Unit- und Integrationstests, relevante E2E-Tests, Build, Security-Auswirkungen, Mobile/Desktop, Regressionen und Dokumentation sind geprüft. Danach folgen sauberer Commit, GitHub-Push, grünes CI, kontrollierte Datenbankmigration, kontrolliertes Deployment und reale Funktionsprüfung. Externe Hindernisse werden als `BLOCKED - EXTERNAL` dokumentiert.

## Arbeitsregeln

- Zu Aufgabenstart diese Karte und `docs/EXECUTION_LEDGER.md` lesen.
- Vor Änderungen den echten Repository-, CI- und Live-Stand messen.
- Bestehende Architektur erweitern, keine unnötige Parallelarchitektur bauen.
- Provider-Provenance und Datenqualität bis in die UI erhalten.
- BauPro niemals verändern, neu deployen oder mit StockPilot-Artefakten vermischen.
- `STATUS.md`, `docs/EXECUTION_LEDGER.md` und belegte Blocker nach jedem Meilenstein aktualisieren.

## Abschluss dieses Arbeitspunkts

Status: abgeschlossen am 2026-08-11.

Belegt durch PR #51, Merge c2e43c6, grüne Main-CI- und pgTAP-Läufe, angewendete Produktionsmigration, READY-Deployment dpl_9rgmGDqW9BqmW3BkJJBmkryKLMab, 5/5 erfolgreiche Live-Smokes und leeres Vercel-Fehlerlog.

Nächster einzelner Phase-1-Arbeitspunkt: Auth-/Passwort-Härtung gemäß BLOCKER-012. Die übergeordnete Marktreife-Mission bleibt aktiv.

## Aktiver Phase-1-Arbeitspunkt: Auth-/Passwort-Härtung

Ziel: Passwort-Reset, App-Regeln und Supabase-Regeln konsistent absichern, ohne die produktive Auth-Konfiguration breit oder unbelegt zu überschreiben.

Lokaler Stand: implementiert und vollständig grün mit 127 Testdateien, 998 Tests, Produktions-Build sowie 35 bestandenen Browser-Tests.

Externe Abnahmebedingung: gezielte Produktionsaktivierung von Mindestlänge und sicherem Passwortwechsel sowie, bei verfügbarem Pro-Tarif, Leaked-Password-Protection. Bis dahin bleibt BLOCKER-012 offen und dieser Arbeitspunkt wird nicht als produktiv abgeschlossen bezeichnet.

Web-App-Stand: Die UI-Härtung ist als Deployment dpl_6LXiqnVm5rurCwWZfVn95xfkFTAD live und technisch grün. Der Arbeitspunkt bleibt ausschließlich wegen der getrennten Supabase-Produktionskonfiguration offen.

## Aktiver Phase-1-Arbeitspunkt: Portfolio-Trade-Mandantengrenze

Ziel: Die atomare Portfolio-RPC akzeptiert keine Nutzer-ID mehr, leitet den Eigentümer ausschließlich aus `auth.uid()` ab und läuft über den tokengebundenen RLS-Client. Direkte RPC-Aufrufe werden zusätzlich durch Datenbankgrenzen validiert.

Lokaler Stand: implementiert und vollständig grün mit 128 Testdateien, 1.001 Tests, 10 pgTAP-Dateien mit 201 Prüfungen, Produktions-Build, 35 bestandenen Browserflüssen und 5/5 parallelen Hydration-Durchläufen.

Produktionsabschluss: PR #55 ist als `6df7f4e` gemergt. Main-CI und Datenbanktests sind grün, Migration `20260811193000` ist angewendet und die neue RPC ist `auth.uid()`-gebunden. Deployment `dpl_H6FXaQ35nnYeLcw2bbxgJMUm9Cqg` ist READY; vier HTTP-Smokes, der echte lokale Portfoliofluss und das Fehlerlog sind grün.

Nächster Schritt: Abschlussdokumentation mergen, danach den nächsten einzelnen Phase-1-Befund auswählen. Die übergeordnete Marktreife-Mission bleibt aktiv.

## Aktiver Phase-1-Arbeitspunkt: Auth-Privilegiengrenze

Ziel: Watchlist-, Alert-, Portfolio-, Billing- und andere normale Nutzerpfade validieren Sessions ausschließlich mit dem tokengebundenen Publishable-Key-Client. Der Service-Role-Client wird weder vorausgesetzt noch im Auth-Ergebnis weitergereicht.

Privilegierte Ausnahmen: DSGVO-Export und administrative Kontolöschung erzeugen den Service-Client erst innerhalb der jeweiligen Operation und brechen bei fehlender Konfiguration sicher ab.

Abnahme: Regressionstest, vollständige Qualitätsgates, GitHub-CI, kontrolliertes StockPilot-Deployment und Live-Smokes. BauPro bleibt vollständig unberührt.

Lokaler Stand: implementiert und grün mit Formatprüfung, Typecheck, Lint, 129 Testdateien und 1.004 Tests, Produktions-Build mit 35 statischen Seiten sowie 35 bestandenen Browserflüssen und einem bewussten Skip.

Produktionsabschluss: PR #57 ist als `3ceac72` gemergt. Main-CI `31518017780` und Datenbanktests `31518017734` sind grün. Das ausschließlich dem Projekt `stockpilot-ai` zugeordnete Deployment `dpl_5a5ih8TAvs1mqcJE8ND8RC8iwAeq` ist READY und bedient die Live-Aliase. Fünf Live-Ziele, lokale Fallbacks für anonyme und ungültige Sessions sowie das Fehlerlog sind geprüft. BauPro blieb unberührt.

Nächster Schritt: den Abschlussnachweis mergen und danach genau einen weiteren Phase-1-Befund anhand von Risiko und Produktwirkung auswählen. Die übergeordnete Marktreife-Mission bleibt aktiv.

## Aktiver Phase-1-Arbeitspunkt: DSGVO-Export-Mandantengrenze

Ziel: Kein Exportpfad darf RLS pauschal umgehen. Alle persönlichen Tabellen werden über den tokengebundenen Nutzerclient gelesen. `billing_events` erhält nur SELECT für eigene Zeilen; INSERT, UPDATE und DELETE bleiben für `authenticated` verboten.

Abnahme: Code-Regression, pgTAP-Mandantentest, vollständige Qualitätsgates, kontrollierte Produktionsmigration, GitHub-CI, StockPilot-Deployment und reale Export-/Fallback-Prüfung. BauPro bleibt vollständig unberührt.

Lokaler Stand: implementiert und grün mit Formatprüfung, Typecheck, Lint, 129 Testdateien und 1.005 Tests, 10 pgTAP-Suiten und 207 Prüfungen, Produktions-Build mit 35 statischen Seiten sowie 35 bestandenen Browserflüssen und einem bewussten Skip.

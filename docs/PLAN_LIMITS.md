# Free/Pro/Premium-Limitvertrag

Stand: 2026-08-21

## Verbindliche Werte

| Ressource | Free | Pro | Premium |
|---|---:|---:|---:|
| Watchlist-Werte | 15 | 250 | 1.000 |
| Alerts | 3 | 100 | 500 |
| Portfolios | 1 | 10 | 25 |
| Historie | 1 Jahr | 10 Jahre | 20 Jahre |
| KI-Analysen | 3/Tag | 100/Tag | 500/Tag |
| API-Aufrufe | 0/Tag | 1.000/Tag | 10.000/Tag |

## Durchsetzung

- `src/lib/feature-gates.ts` ist der kanonische Anwendungsvertrag für UI, API und Quoten.
- `private.plan_limit_contract` spiegelt die Werte serverseitig in PostgreSQL.
- `private.current_plan_limit` liefert ausschließlich `free`, `pro` oder `premium`; abgelaufene oder fehlende Berechtigungen fallen auf Free zurück.
- Trigger erzwingen Watchlist-, Alert- und Portfolio-Grenzen transaktional mit Advisory Locks.
- Ein Downgrade löscht keine Nutzerdaten, verhindert aber neue Einträge oberhalb des niedrigeren Limits.
- Legacy-Aliase `starter -> pro` und `elite -> premium` bleiben ausschließlich für alte gespeicherte Daten kompatibel. Aktive Produkttexte und API-Antworten nennen sie nicht.

## Sicherheitsregeln

- Die Vertragstabelle liegt im Schema `private` und ist für `anon` sowie `authenticated` nicht direkt les- oder schreibbar.
- Ungültige Ressourcen werden abgewiesen; unvollständige Vertragszeilen führen fail-closed zu einem Fehler.
- Limits werden serverseitig durchgesetzt. Eine UI-Anzeige allein erteilt keine Berechtigung.

## Verifikation

- 13 gezielte TypeScript-Vertragstests bestanden.
- 40 neue pgTAP-Assertions prüfen Werte, Rechte, Grenzwerte sowie Upgrade/Downgrade.
- Gesamte Datenbanksuite: 12 Dateien, 300 Assertions bestanden.
- Gesamte Vitest-Suite: 160 Dateien, 1.212 Tests bestanden.
- Typecheck, Lint, Produktionsbuild und Dependency-Audit bestanden.

## Produktionsstatus

Die Migration `20260821171602_unify_free_pro_premium_limits.sql` ist lokal vollständig verifiziert, aber noch nicht auf Produktion angewendet. Das Supabase-Projekt `STAI` ist extern `INACTIVE`; eine Wiederherstellung ist wegen des Free-Account-Limits blockiert. Bis zur Wiederherstellung ist dieser Meilenstein intern vollständig, extern jedoch nicht aktiviert.

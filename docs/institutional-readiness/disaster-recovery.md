# Disaster Recovery

## Vorläufige Ziele, nicht als SLA vereinbart

| Dienst | RTO-Ziel | RPO-Ziel | Voraussetzung |
| --- | ---: | ---: | --- |
| öffentliche Analyseoberfläche | 4 h | 24 h | Vercel-Rebuild, Provider-Fallback |
| Auth/Portfolios | 8 h | 24 h | Supabase Backup/PITR je Tarif |
| Intelligence Raw/Analysen | 8 h | 24 h | DB-Restore und Provider-Retention |
| Audit Logs | 8 h | 0-24 h | verschlüsselter Backup-/WORM-Export |

## Restore-Prozess

1. Incident deklarieren und Writes stoppen.
2. Letzten bekannten guten Change/Migrationsstand bestimmen.
3. Neues isoliertes Supabase-Projekt/Branch bereitstellen.
4. Schema aus Migrationen aufbauen.
5. verschlüsseltes Backup einspielen.
6. RLS-, Integritäts-, Tenant- und Reproduction-Tests ausführen.
7. Read-only Smoke Test und Datenqualitätsabgleich.
8. kontrolliertes Umschalten, Monitoring und Nachkontrolle.

## Aktueller Nachweis

DR-Smoke, Offline-Fallback und Migrationsaufbau sind automatisiert. Ein vollständiger Restore mit Backupdaten wurde nicht ausgeführt, weil keine isolierte kostenfreie Branch-/Docker-Umgebung verfügbar war. Daher bleibt DR-Reifegrad 2 und `institutional_review_ready` ausgeschlossen.

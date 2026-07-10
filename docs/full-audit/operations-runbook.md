# Operations Runbook

## Deployment

1. Typecheck, Lint, Unit, Coverage, pgTAP, E2E, Lizenz-/Secret-/Dependency-Audit und Build ausführen.
2. Migrationen vor dem App-Deployment anwenden und Advisor prüfen.
3. Preview mit produktionsähnlichen, getrennten Secrets testen.
4. Erst danach Production promoten; BauPro-Projekt niemals verlinken oder ändern.

## Rollback

- App: vorheriges Vercel-Deployment promoten.
- Datenbank: vorwärts korrigierende Migration bevorzugen; destruktive Rückmigration nur nach Backup/Restore-Test.
- Provider: ENV-Schalter auf sicheren Mock-/Unavailable-Modus setzen, Datenqualität sichtbar lassen.

## Datenbank-Restore

- Supabase-PITR/Backups nach gebuchtem Plan nutzen; Restore zuerst in isolierter Umgebung prüfen.
- Auth-Nutzer, RLS, Constraints, Counts und Integritätsabfragen nach Restore validieren.

## Störungen

- Provider-Ausfall: Circuit/Backoff beobachten, Cache markieren, keinen Live-Status vortäuschen.
- WebSocket-Ausfall: SSE schließt, Client wechselt auf begrenztes REST-Polling.
- KI-Kostenexplosion: `AI_PROVIDER=rules`, API-Key rotieren, Logs/Tokenkosten prüfen.
- Kompromittierter Key: Provider/Vercel/Supabase rotieren, alte Keys widerrufen, Logs prüfen, Nutzer nach Incident-Plan informieren.
- Fehlerhafte Migration: Writes stoppen, Backup bewerten, vorwärts korrigieren oder getesteten Restore durchführen.
- Security Incident: Secrets sperren, Beweise sichern, Scope bestimmen, Datenschutz-/Rechtsprüfung und Meldefristen starten.

## Monitoring und Retention

- Health, Providerstatus, Rate-Limits, 5xx, p95/p99, Cronstatus, DB-Verbindungen, Queue-Tiefe und KI-Kosten alarmieren.
- Log-Aufbewahrung und Intelligence-Retention vertraglich/DSGVO-konform definieren; Secrets werden redigiert.

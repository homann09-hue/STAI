# ADR-011: Logging und Audit

- Status: accepted, pilot
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Strukturierte redigierte Logs plus separate append-only, hashverkettete Audit-Events.

## Alternativen

Nur Console Logs, externer SIEM-only Agent, vollständige Payloadlogs.

## Auswirkungen

Nachvollziehbarkeit steigt; Hashkette ist kein externes WORM.

## Sicherheitsfolgen

PII/Secrets redigieren, Größenlimits, server-only Zugriff.

## Skalierungsfolgen

Externes Logbackend vor hohem Volumen.

## Kostenfolgen

Ingest/Retention budgetieren.

## Betriebsfolgen

SIEM, Alertregeln und Auditexport sind offen.

## Rückbauoption

Auditexport sichern, Logdestination wechseln; Daten nicht still löschen.

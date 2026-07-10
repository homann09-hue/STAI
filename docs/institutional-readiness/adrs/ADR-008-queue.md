# ADR-008: Queue

- Status: proposed
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Aktuell Postgres-Processing-Jobs; vor institutionellem Volumen ist eine durable Queue mit Idempotency und Dead Letter Queue erforderlich.

## Alternativen

In-memory Queue, Upstash Queue, SQS/Kafka.

## Auswirkungen

Aktuelle Lösung ist nachvollziehbar, aber nicht hochverfügbar genug.

## Sicherheitsfolgen

Tenant-/Payload-Minimierung, verschlüsselte Verbindung, keine Secrets.

## Skalierungsfolgen

Postgres ist Kapazitätsgrenze; externer Dienst für Bursts.

## Kostenfolgen

Zusatzdienst und Egress.

## Betriebsfolgen

Queue Depth, Age, Retry, DLQ und Replay Runbook.

## Rückbauoption

Consumer stoppen, Postgres-Jobs erhalten und kontrolliert replayen.

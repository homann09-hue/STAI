# ADR-016: Alerting

- Status: accepted, restricted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Alertregeln werden gespeichert; kritische automatische Intelligence-Alerts benötigen hohe Confirmation/Entity/Novelty-Schwellen. Externe Zustellung bleibt deaktiviert ohne Worker.

## Alternativen

Client-only Alerts, direkter Push, externer Alertdienst.

## Auswirkungen

Keine vorgetäuschte Zustellung; Funktionsumfang begrenzt.

## Sicherheitsfolgen

Tenant-RLS, Dedupe, Audit und Rate Limit.

## Skalierungsfolgen

Durable Worker/Queue für Enterprise nötig.

## Kostenfolgen

Kanal- und Providerkosten.

## Betriebsfolgen

Delivery Latency, Failure, Suppression und Replay.

## Rückbauoption

Zustellung stoppen, Regeln behalten, Status nicht aktiv anzeigen.

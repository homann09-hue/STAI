# ADR-007: Realtime-Architektur

- Status: accepted, degraded-capable
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Serverseitige Providerverbindung, normalisierte SSE/Stream-Antwort, REST-Polling-Fallback und ehrliche Quality Badges.

## Alternativen

Direkter Browser-WebSocket, reines Polling, eigener Tickbus.

## Auswirkungen

Keys geschützt und kontrollierte Degradation; echtes Tick-Realtime bleibt planabhängig.

## Sicherheitsfolgen

Subscriptions nur aktive Symbole; Heartbeat und Limits.

## Skalierungsfolgen

Shared Fan-out ist für institutionelle Last noch nötig.

## Kostenfolgen

WebSocket-/Egresskosten beobachten.

## Betriebsfolgen

Reconnect-Stürme und Providerstatus messen.

## Rückbauoption

Stream deaktivieren und Polling/Delayed Mode nutzen.

# ADR-005: Marktdatenprovider

- Status: accepted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Normalisierte Multi-Provider-Schicht mit sichtbarer Qualität und Lizenzstatus; Yahoo bleibt keine professionelle Hauptquelle.

## Alternativen

Ein Anbieter, direkter Clientzugriff, eigene Börsenfeeds.

## Auswirkungen

Fallbacks reduzieren Ausfälle, lösen keine Lizenzfrage.

## Sicherheitsfolgen

Keys serverseitig; unplausible Daten quarantänisieren.

## Skalierungsfolgen

Batching, Cache und aktive Subscriptions.

## Kostenfolgen

Plan-/Börsenlizenzkosten sind wesentlicher Treiber.

## Betriebsfolgen

Provider Health, Rate Limit und Datenlatenz überwachen.

## Rückbauoption

Provider per ENV wechseln; Cache/Delayed Mode.

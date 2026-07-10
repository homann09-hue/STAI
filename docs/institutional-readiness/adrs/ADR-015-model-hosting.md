# ADR-015: Modellhosting

- Status: proposed
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Kein eigener GPU-Server im aktuellen Pilot; externe API plus deterministischer Fallback. Kundenspezifische Modelle bleiben deaktiviert.

## Alternativen

Self-hosted GPU, Vercel AI Gateway, mehrere externe Anbieter.

## Auswirkungen

Reduziert Betriebslast, erhöht Provider-/Datenschutzabhängigkeit.

## Sicherheitsfolgen

DPA, Retention, Region, keine Secrets/PII im Prompt.

## Skalierungsfolgen

Provider skaliert, Quoten bleiben Grenze.

## Kostenfolgen

Token statt GPU-Grundkosten.

## Betriebsfolgen

Latenz, Kosten, Drift, Ausfall, Kill Switch.

## Rückbauoption

Provider deaktivieren und Regeln nutzen; später exportierbares Modellinterface.

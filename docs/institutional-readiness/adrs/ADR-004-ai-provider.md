# ADR-004: KI-Provider

- Status: accepted, pilot
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

OpenAI-kompatible Providerabstraktion mit strukturiertem Schema, Limits und deterministischem Fallback.

## Alternativen

Ein fest verdrahteter Provider, ausschließlich lokales Modell, keine KI.

## Auswirkungen

Flexibilität und Resilienz; Modellrisiko bleibt.

## Sicherheitsfolgen

Prompt Injection als untrusted data, keine Tools/Secrets, Outputvalidierung.

## Skalierungsfolgen

Semaphore und Budgets begrenzen Parallelität.

## Kostenfolgen

Tokenkosten, Fallback kostenfrei.

## Betriebsfolgen

Modellinventar, Regression, Kill Switch und Driftmonitoring.

## Rückbauoption

Provider auf mock/none setzen und Rohdaten weiter anzeigen.

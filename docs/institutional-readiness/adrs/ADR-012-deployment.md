# ADR-012: Deployment

- Status: accepted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Vercel mit getrenntem StockPilot-Projekt, manueller Production-Bestätigung und Prebuilt Artifact.

## Alternativen

Direktdeploy, Container/Kubernetes, anderer PaaS.

## Auswirkungen

Schneller Betrieb, Plattformabhängigkeit.

## Sicherheitsfolgen

Least-Privilege-Tokens, keine Prodkeys in Preview.

## Skalierungsfolgen

Serverless skaliert; Stateful Fan-out extern.

## Kostenfolgen

Functions/Egress beobachten.

## Betriebsfolgen

Smoke, Monitoring und Rollbacknachweis pro High-Risk-Release.

## Rückbauoption

Vorheriges Vercel Deployment promoten oder neu bauen.

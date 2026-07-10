# ADR-014: Row Level Security

- Status: accepted, mandatory
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Jede nutzer- oder tenantbezogene Tabelle hat RLS; server-only Tabellen verweigern anon/authenticated vollständig.

## Alternativen

Nur API-Autorisierung, separate DB, SECURITY DEFINER überall.

## Auswirkungen

Defense in depth; Policies erhöhen Migrationskomplexität.

## Sicherheitsfolgen

Negative pgTAP-Tests und Composite Owner-FKs.

## Skalierungsfolgen

Policy-/Indexdesign beeinflusst Query-Latenz.

## Kostenfolgen

Geringe direkte Kosten.

## Betriebsfolgen

Advisor und DB-Tests bei jeder Migration.

## Rückbauoption

Neue Migration korrigiert Policy; niemals RLS pauschal deaktivieren.

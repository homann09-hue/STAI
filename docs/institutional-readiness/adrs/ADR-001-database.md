# ADR-001: Datenbank

- Status: accepted, pilot
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Supabase Postgres bleibt System of Record; Änderungen erfolgen ausschließlich über versionierte Migrationen, Constraints und RLS.

## Alternativen

Eigenbetrieb, Neon/RDS, dokumentenorientierte Datenbank.

## Auswirkungen

Postgres-Portabilität bleibt erhalten, Managed-Funktionen erzeugen dennoch Providerabhängigkeit.

## Sicherheitsfolgen

Service Role nur serverseitig; RLS und FK-Integrität sind Pflicht.

## Skalierungsfolgen

Vertikal/Read Replicas später; aktuelle Region ist ein Ausfallbereich.

## Kostenfolgen

Managed Tarif, PITR und Egress müssen vertraglich budgetiert werden.

## Betriebsfolgen

Migrations-, Backup-, Restore- und Advisor-Prozess erforderlich.

## Rückbauoption

SQL-Export und Migration zu kompatiblem Postgres; additive Spalten zunächst behalten.

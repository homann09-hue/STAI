# ADR-013: Secrets Management

- Status: accepted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Server-ENV/Vercel Secrets; nur Supabase Publishable Key darf öffentlich sein; getrennte Admin-/Cron-/Provider-Secrets.

## Alternativen

Secrets im Repo, Clientkeys, externer Vault.

## Auswirkungen

Einfach, aber Rotation und Zugriffsevidence sind Plattformprozesse.

## Sicherheitsfolgen

Konstanter Vergleich, Redaction, Secret Scan.

## Skalierungsfolgen

Keine wesentliche Skalierungswirkung.

## Kostenfolgen

Vault wäre Zusatzkosten.

## Betriebsfolgen

Rotation, Owner und Ablaufdaten organisatorisch festlegen.

## Rückbauoption

Provider deaktivieren, Secret rotieren, Deployment neu starten.

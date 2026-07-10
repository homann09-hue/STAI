# ADR-006: News- und Filingprovider

- Status: accepted
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

NewsAPI/Marketaux/FMP über Adapter; SEC EDGAR als Primärquelle für US-Filings.

## Alternativen

Scraping, einzelner Aggregator, redaktioneller Feed.

## Auswirkungen

Quellenvielfalt, aber Duplikate und widersprüchliche Meldungen.

## Sicherheitsfolgen

URL/Publisher/Confirmation/DQ speichern; Raw Payload server-only.

## Skalierungsfolgen

Ingest in Batches; durable Queue später.

## Kostenfolgen

Archivierungs-/Anzeigerechte prüfen.

## Betriebsfolgen

Deduplizierung, Quarantäne und Providerstatus.

## Rückbauoption

Adapter deaktivieren, ungeanalysierte Quelle sichtbar lassen.

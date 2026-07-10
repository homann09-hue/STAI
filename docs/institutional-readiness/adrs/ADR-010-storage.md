# ADR-010: Storage

- Status: accepted, minimal
- Datum: 10.07.2026

## Kontext

StockPilot AI benötigt eine nachweisbare, rückbaubare Entscheidung für diesen institutionell relevanten Baustein.

## Entscheidung

Strukturierte Daten in Postgres; kein aktiver Objektupload für Enterprisekunden, bis Tenantpfad, Malwareprüfung und Retention implementiert sind.

## Alternativen

Supabase Storage, Vercel Blob, S3.

## Auswirkungen

Reduziert Angriffsfläche, begrenzt Dokumentworkflows.

## Sicherheitsfolgen

Keine ungescannten Uploads; signierte URLs und RLS später.

## Skalierungsfolgen

Objektspeicher separat skalierbar.

## Kostenfolgen

Storage/Egress/Scanning.

## Betriebsfolgen

Lifecycle und Legal Hold nötig.

## Rückbauoption

Feature Flag deaktiviert lassen; exportierbare Postgresdaten.

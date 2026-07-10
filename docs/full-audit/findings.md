# Full Audit Findings

## Critical

Keine bestätigten Critical-Findings im geprüften Stand.

## High, behoben

| ID | Ursache und Auswirkung | Fix | Regression |
| --- | --- | --- | --- |
| H-01 | Portfolio-RPC schrieb Verkäufe vor Bestandsprüfung; Historie konnte von Position abweichen | Validierung vor Insert, Überverkauf wird atomar abgewiesen | pgTAP-RPC-Test und Unit-Test |
| H-02 | Fehlende Owner-FKs und Unique-Garantien ermöglichten relationale Mandanteninkonsistenz und Race-Duplikate | Composite-FKs, Partial-Unique-Indizes, Advisory Lock | Datenbankvertragstest |
| H-03 | Finnhub-WebSocket markierte Daten unabhängig vom Tarif hart als Realtime | Qualität wird vom konfigurierten Providervertrag übernommen | Typecheck und Stream-E2E |

## Medium, behoben

- M-01: Secretvergleich auf timing-sichere SHA-256-Digests umgestellt.
- M-02: KI-Quelltext, Antwortgröße und Ausgabetokens begrenzt; ungültige Modellausgabe fällt auf geprüfte Regeln zurück.
- M-03: Finnhub-Nachrichtenqueue auf 32 Batches begrenzt.
- M-04: Unsicherer nicht-atomarer Server-Fallback für Portfolio-Schreibvorgänge entfernt.
- M-05: Datenexport und bestätigte Konto-/Cloud-/Lokaldatenlöschung ergänzt.
- M-06: Node-Engine gegen unbeabsichtigte Major-Upgrades auf `<25` begrenzt.

## Offen

- Providerverträge, vollständige Betreiberangaben, Datenschutztexte und Finanzaufsichtsfragen benötigen externe Prüfung.
- Echte Billing-Gates, SMTP, Error Tracking, Staging und dokumentierter Restore-Drill sind organisatorisch/vertraglich offen.
- Große UI-/Provider-Dateien bleiben wartbar, sollten aber bei künftigen Features modularisiert werden.

# StockPilot Operating Card

<!-- ACTIVE_WORKPOINT: PHASE-2-4-IN-REVIEW -->

Stand: 2026-08-22

## Arbeitsgrenzen

- Ausschließlich `homann09-hue/STAI`; BauPro und andere Projekte niemals verändern oder deployen.
- Immer nur ein Arbeitspunkt auf aktuellem, geprüftem `main`.
- Keine Secrets committen, loggen oder an den Browser ausliefern.
- Kein Paid-Feature, Mockwert oder Providerstatus als aktiv darstellen, wenn der reale Nachweis fehlt.

## Pflichtablauf

1. Main, Arbeitsbaum, offene PRs, CI und Production-Liveness prüfen.
2. Fehler reproduzieren und Ursache, Verträge sowie Nebenwirkungen erfassen.
3. Implementierung mit passenden Unit-, Route-, Integrations-, DB- und Browser-Tests abschließen.
4. Format, Governance, Typecheck, Lint, Vitest und Build ausführen.
5. Status, Ledger und Blocker mit echten Zahlen aktualisieren.
6. Commit, Branch, PR, Pflicht-CI, Datenbank-CI und StockPilot-Preview prüfen.
7. Erst nach grünem geschütztem Merge Production und Alias prüfen.

## Daten-Invarianten

- Das öffentliche Instrument ist die kanonische Listing-ID, nicht ein nacktes Symbol.
- Symbolgleiche Listings werden nie geraten oder vermischt.
- Provider-Symbole kommen ausschließlich aus dem serverseitigen Instrument Master.
- Failover verwendet für jeden Provider dessen eigenes belegtes Symbol.
- Fehlende oder kollidierende Mappings schlagen vor dem Provider-Aufruf kontrolliert fehl.
- Cache-Keys enthalten Listing, interne Instrument-ID, Provider und Provider-Symbol.
- Jede Quote trägt Provider, Zeitpunkt, Qualität und nach kanonischer Auflösung die Listing-ID.
- Der Legacy-Symbolpfad bleibt nur für noch nicht migrierte interne Aufrufer und wird als solcher ausgewiesen.
- SSE und REST-Fallback müssen denselben Identitätsmodus und dieselben Listing-Keys verwenden.
- Kanonische Stream-Quotes werden ausschließlich unter `canonicalId`, nie zusätzlich unter Symbol gespeichert.
- Externe Kurse bleiben gesperrt, bis öffentliche Anzeigerechte schriftlich belegt sind.

## Billing-Invarianten

- Billing bleibt bis zum grünen Phase-1.5-Testmode-Gate und den externen Live-Freigaben deaktiviert.
- Stripe ist auf Nutzerentscheidung vorerst übersprungen; keine Paid-Aktivierung behaupten.

## Aktuelle externe Blocker

- Supabase `STAI` ist `INACTIVE`; keine Remote-Migration oder authentifizierte Production-Abnahme.
- Für externe FMP-/Finnhub-/Alpha-Vantage-Kurse fehlen belegte öffentliche Anzeigerechte.
- Stripe-Test-Clock-Dunning ist mit dem vorhandenen eingeschränkten Testzugang nicht abschließbar.

## Incident-Regel

Bei möglichem Doppelabo, falscher Freischaltung, Datenleck oder falschen Marktdaten: Paid-/Datenpfad fail-closed setzen, Ziel und Recovery prüfen, keine destruktive Aktion ohne explizite Freigabe.

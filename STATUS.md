# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfter Ausgangsstand: `main` bei `9d536243c8a930fb82e25922d4af3be2c8d9d741`
- Aktive Phase: **Phase 2.2 - kanonische Identität für Quote-Batches**
- Arbeitsstatus: lokal implementiert und vollständig geprüft; PR/CI/Preview stehen aus
- Billing: deaktiviert; Stripe auf Nutzerwunsch vorerst übersprungen

## Aktuelle Verbesserung

Die Quote-Batchroute und das globale Asset-Autocomplete arbeiten nun mit
kanonischen Listing-IDs. Cache und Response sind listing-spezifisch. Wenn zwei
Listings beim aktiven Provider auf dasselbe Provider-Symbol fallen, wird der
Abruf mit einem erklärten Konflikt abgebrochen statt Kurse zu vermischen.

Der bestehende Symbolpfad bleibt als `legacy_symbol` verfügbar, damit noch
nicht migrierte Watchlist- und Stream-Aufrufer stabil bleiben. Seine Ablösung
ist der nächste getrennte Arbeitspunkt.

## Verifikation

- Format und Governance: bestanden
- TypeScript: bestanden
- ESLint ohne Warnungen: bestanden
- fokussierte Regressionstests: 21/21 bestanden
- kritische Route/Identitätslogik: 99,07 % Lines und 95,69 % Branches
- gesamte Testsuite: 169 Dateien, 1.321/1.321 Tests bestanden
- Next.js-Produktionsbuild: bestanden, 35 statische Seiten

## Production

Die Release-Automation ist abgeschlossen. Geschützte Main-Merges deployen
wieder ausschließlich das Vercel-Projekt `stockpilot-ai`. Der aktuelle
Production-Stand `9d53624` ist unter `https://stockpilot-ai-beta.vercel.app`
verifiziert. BauPro und andere Projekte bleiben unberührt.

## Externe Blocker

- Keine belegten öffentlichen Anzeigerechte für die vorhandenen kommerziellen Marktdatenzugänge
- Supabase-Projekt `STAI` zuletzt `INACTIVE`; Remote-Abnahme nicht möglich
- Stripe-Test-Clock-Dunning mit vorhandenem eingeschränkten Zugang nicht abschließbar

## Nächster zulässiger Schritt

Phase 2.2 über PR, CI und Preview absichern, geschützt mergen und Production
prüfen. Danach die verbleibenden Legacy-Symbol-Aufrufer jeweils in einem
eigenen, getesteten Arbeitspunkt migrieren.

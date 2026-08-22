# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfter Ausgangsstand: `main` bei `255867e783c276335955a2b8925b5132dae006b5`
- Aktive Phase: **Phase 2.3 - kanonische Identität im Market-Stream**
- Arbeitsstatus: lokal implementiert und vollständig geprüft; PR/CI/Preview stehen aus
- Billing: deaktiviert; Stripe auf Nutzerwunsch vorerst übersprungen

## Aktuelle Verbesserung

Asset-Detailseiten abonnieren Kurse jetzt mit ihrer serverseitig aufgelösten
kanonischen Listing-ID. Stream-Route, SSE-Nachrichten, Client-State und
REST-Fallback erhalten denselben Identitätsmodus. Symbolgleiche Listings werden
nicht vermischt; fehlende Provider-Mappings liefern einen kontrollierten
Konflikt.

Ein echter bestehender Client-Race wurde ebenfalls behoben: Der gedrosselte
Quote-Puffer wird vor Reacts asynchronem State-Update gesichert und nicht mehr
vorzeitig geleert.

Dashboard und Watchlist sind bewusst noch als `legacy_symbol` ausgewiesen.
Ihre kanonische Migration benötigt belastbare Listing-IDs im jeweiligen
Datenmodell und bleibt ein getrennter Arbeitspunkt.

## Verifikation

- Format und Governance: bestanden
- TypeScript und ESLint: bestanden
- fokussierte Stream-/Identitätstests: 14/14 bestanden
- kritische Stream-Route: 99,02 % Lines / 95,08 % Branches
- gesamte Testsuite: 172 Dateien, 1.335/1.335 Tests bestanden
- Next.js-Produktionsbuild: bestanden, 35 statische Seiten

## Aktuelle Production

Der vor diesem Arbeitspunkt geprüfte Main-Stand `255867e` läuft im
StockPilot-Projekt unter `https://stockpilot-ai-beta.vercel.app`. Phase 2.3 ist
noch nicht gemergt oder live und wird bis zur vollständigen Release-Abnahme
nicht als Production-Funktion bezeichnet. BauPro bleibt unberührt.

## Externe Blocker

- Keine belegten öffentlichen Anzeigerechte für die vorhandenen Marktdatenzugänge
- Supabase-Projekt `STAI` zuletzt `INACTIVE`; Remote-Abnahme nicht möglich
- Stripe-Test-Clock-Dunning mit vorhandenem eingeschränkten Zugang nicht abschließbar

## Nächster zulässiger Schritt

Phase 2.3 über PR, CI, pgTAP und Preview absichern, geschützt mergen und den
kanonischen SSE-Vertrag in Production prüfen. Erst danach folgt der nächste
einzelne Phase-2-Identitätspfad.

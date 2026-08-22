# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfter Ausgangsstand: `main` bei `f353c09505bfb70ba32cb69247c26224deb59953`
- Aktive Phase: **Phase 2.4 - listinggenaue Provider-Symbolauflösung**
- Arbeitsstatus: Implementierung und lokale Pflichtgates bestanden; PR-/CI-/Live-Abnahme ausstehend
- Billing: deaktiviert; Stripe auf Nutzerwunsch vorerst übersprungen

## Aktuelle Verbesserung

Kanonische Quote- und Stream-Anfragen leiten das Provider-Symbol nicht mehr
aus dem nackten Ticker ab. Der serverseitige Instrument Master löst
`canonicalId`, interne Instrument-ID und die Zuordnung für jeden aktiven
Provider auf. Provider-Failover verwendet je Anbieter dessen eigenes
verifiziertes Symbol.

Fehlende Referenzdaten, unbekannte Instrumente, fehlende oder widersprüchliche
Mappings sowie Provider-Symbol-Kollisionen werden getrennt und fail-closed
behandelt. Zwei Listings mit demselben öffentlichen Symbol bleiben durch
Provider, Provider-Symbol, Venue, Währung, Instrument-ID und Cache-Key getrennt.
Providerantworten mit falscher Währung oder abweichender Identität werden
verworfen.

Dashboard und Watchlist bleiben bewusst als `legacy_symbol` ausgewiesen.
Ihre kanonische Migration benötigt belastbare Listing-IDs im jeweiligen
Datenmodell und bleibt ein getrennter Arbeitspunkt.

## Lokale Verifikation

- Formatcheck, TypeScript und ESLint ohne Warnungen: bestanden
- fokussierte Mapping-/Store-/Failover-/Route-Tests: 5 Dateien, 33/33 bestanden
- vollständige Vitest-Suite: 174 Dateien, 1.347/1.347 Tests bestanden
- Next.js-Produktionsbuild: bestanden, 35 statische Seiten
- Mapping-Domäne: 100 % Lines / 89,69 % Branches
- Quote-Route: 97,46 % Lines / 92,95 % Branches
- Stream-Route: 97,39 % Lines / 92,75 % Branches

## Production

Der vor diesem Arbeitspunkt geprüfte Main-Stand
`f353c09505bfb70ba32cb69247c26224deb59953` läuft unter
`https://stockpilot-ai-beta.vercel.app`. Alle geprüften Kernseiten und
`/api/health` liefern HTTP 200; im Prüfzeitraum bestanden keine
Vercel-Error-Logs.

Phase 2.4 ist noch nicht gemergt oder deployt und wird deshalb nicht als live
bezeichnet.

## Externe Blocker

- Keine belegten öffentlichen Anzeigerechte für die vorhandenen Marktdatenzugänge
- Supabase-Projekt `STAI` zuletzt `INACTIVE`; echte Instrument-Master-Auflösung in Production nicht prüfbar
- Stripe-Test-Clock-Dunning mit vorhandenem eingeschränkten Zugang nicht abschließbar

## Nächster zulässiger Schritt

Phase 2.4 committen, als einzelnen PR prüfen, Pflicht-CI und Datenbank-CI
abwarten, StockPilot-Preview abnehmen und erst danach geschützt mergen und
Production prüfen.

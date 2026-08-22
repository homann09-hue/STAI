# StockPilot AI Status

Stand: 2026-08-22

## Verbindlicher Stand

- Repository: `homann09-hue/STAI`
- Geprüfter Ausgangsstand: `main` bei `e03c2a633551624474cb57dda0cf7cadf0818f5e`
- Aktive Phase: **Phase 2.4 - Timeout-Remediation der Provider-Symbolauflösung**
- Arbeitsstatus: Mapping gemergt und deployt; gemessene Timeout-Remediation lokal bestanden, Folge-PR ausstehend
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

Die Production-Abnahme des gemergten Mappings fand bei inaktivem Supabase
einen zu langsamen Fail-closed-Pfad: REST und SSE benötigten jeweils rund 7,3
Sekunden bis zum kontrollierten HTTP 503. Die laufende Remediation begrenzt
jede Instrument-Master-Abfrage mit einem echten AbortSignal auf höchstens
2.000 Millisekunden und normalisiert sowohl zurückgegebene als auch geworfene
Abort-Fehler.

Dashboard und Watchlist bleiben bewusst als `legacy_symbol` ausgewiesen.
Ihre kanonische Migration benötigt belastbare Listing-IDs im jeweiligen
Datenmodell und bleibt ein getrennter Arbeitspunkt.

## Lokale Verifikation

- Formatcheck, TypeScript und ESLint ohne Warnungen: bestanden
- fokussierte Mapping-/Store-/Failover-/Route-Tests: 5 Dateien, 33/33 bestanden
- vollständige Vitest-Suite: 174 Dateien, 1.351/1.351 Tests bestanden
- realistische lokale Production-Sandbox: REST 0,138 s / SSE 0,116 s bis zum kontrollierten HTTP 503
- Next.js-Produktionsbuild: bestanden, 35 statische Seiten
- Mapping-Domäne: 100 % Lines / 89,69 % Branches
- Quote-Route: 97,46 % Lines / 92,95 % Branches
- Stream-Route: 97,39 % Lines / 92,75 % Branches

## Production

Main `e03c2a633551624474cb57dda0cf7cadf0818f5e` läuft als
`dpl_ei15mz8GkwUe49UfVjb3UQCmkjoW` unter
`https://stockpilot-ai-beta.vercel.app`. Kernseiten und `/api/health` liefern
HTTP 200. Kanonische REST- und SSE-Anfragen bleiben wegen des inaktiven
Instrument Masters korrekt bei HTTP 503, benötigten in der Live-Messung aber
rund 7,3 Sekunden. Die dabei protokollierten Error-Events stammen aus diesen
gezielten Smoke-Requests.

Der Zwei-Sekunden-Abbruch ist noch nicht gemergt oder deployt und wird deshalb
noch nicht als live behoben bezeichnet.

## Externe Blocker

- Keine belegten öffentlichen Anzeigerechte für die vorhandenen Marktdatenzugänge
- Supabase-Projekt `STAI` zuletzt `INACTIVE`; echte Instrument-Master-Auflösung in Production nicht prüfbar
- Stripe-Test-Clock-Dunning mit vorhandenem eingeschränkten Zugang nicht abschließbar
- Vercel-Preview für PR #126 wegen Buildlimit für 24 Stunden abgewiesen; Pflichtcheck bleibt rot

## Nächster zulässiger Schritt

Timeout-Remediation committen, als Folge-PR desselben Arbeitspunkts prüfen,
den Vercel-Preview-Check nach Freigabe des Buildlimits neu ausführen und danach
den Production-503 erneut messen. Keine Folgephase vorher beginnen.

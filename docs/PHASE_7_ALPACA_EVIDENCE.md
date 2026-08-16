# Phase 7 – Alpaca-Realtime: Abnahmenachweis

Stand: 2026-08-16

## Status

**IMPLEMENTIERT / AKTIVIERUNG BLOCKED – EXTERNAL**

Der Adapter ist produktionsreif integriert und ohne Konfiguration fail-closed.
In Produktion fehlen `ALPACA_API_KEY_ID` und `ALPACA_API_SECRET_KEY`.
Externe Anzeige- und Weitergaberechte wurden nicht nachgewiesen. Deshalb ist
Alpaca dort nicht aktiviert und wird nicht als Datenquelle beworben.

## Gelieferter Umfang

- Einzel- und Batch-Snapshots, letzte Trades und Market Clock
- paginierte historische Bars mit explizitem `adjustment=raw`
- Quote-/Trade-WebSockets mit Authentifizierung, Reconnect, Resubscribe,
  Symbolgrenze, Backpressure-Schutz und kontrolliertem Prozess-Lease
- REST-Polling als Fallback
- normalisierte Quotes, Trades und Bars mit Provider, Feed, Zeitstempel,
  Qualität, Latenz und Qualitätsproblemen
- ehrliche Abgrenzung von IEX, SIP und Delayed SIP
- serverseitige Secret-Header; keine Schlüssel in URL, Browser oder Cache-Key
- SSRF-Allowlist, Timeout, Payload-Limit, Rate-Limit- und Fehlerklassifizierung

## Verifikation

- TypeScript, ESLint, Format und Produktions-Build: bestanden
- Unit/Integration: 152 Dateien, 1.146 Tests bestanden
- Coverage: 47,59 % Statements, 45,29 % Branches, 47,20 % Functions,
  49,39 % Lines
- Datenbank: 10 pgTAP-Dateien, 224 Tests bestanden
- Browser/Mobile/Offline: 35 bestanden, 1 absichtlich projektbedingt
  übersprungen
- 2.000 aktive Sitzungen: 2.000/2.000 erfolgreich, p95 391 ms
- 10.000 Kapazitätssitzungen: 10.000/10.000 erfolgreich, p95 1.105 ms
- Chaos-, Grammatik-, Dependency-, Lizenz-, Performance-, Enterprise- und
  Institutional-Gates: bestanden
- GitHub CI `31969442452`, pgTAP `31969442515` und Vercel-Preview für
  ausschließlich `stockpilot-ai`: bestanden

Die Ein-Prozess-Probe mit 2.000 sofortigen Requests ist kein Release-Gate:
1.927 Antworten waren erfolgreich, 73 liefen nach 15 Sekunden in den
Test-Timeout. Das ist Horizontal-Skalierungs-Evidenz und keine Aussage über
2.000 realistisch verteilte aktive Sitzungen.

## Aktivierung

1. Alpaca-Konto und passenden Marktdatenplan bereitstellen.
2. Externe Anzeige-/Redistributionsrechte schriftlich bestätigen.
3. `ALPACA_API_KEY_ID` und `ALPACA_API_SECRET_KEY` serverseitig setzen.
4. `ALPACA_DATA_FEED` passend zum Vertrag wählen.
5. `MARKET_DATA_ENABLE_ALPACA=true` setzen.
6. Optional `ALPACA_STREAM_ENABLED=true` setzen.
7. Echten Quote-/Trade-/Bar-/Reconnect-Smoke erneut abnehmen.

Offizielle technische Quellen und Grenzen stehen in
[ALPACA_ADAPTER.md](ALPACA_ADAPTER.md).

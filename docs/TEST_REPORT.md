# Test Report

Stand: 2026-06-29

## Finale QA-Kommandos

- `npm run qa:redteam`
- Manuelle In-App-Browser-Prüfung auf `http://localhost:3000/` und `http://localhost:3000/assets/NVDA`

## Ergebnis

- TypeScript: bestanden mit `tsc --noEmit`
- Lint: bestanden mit `eslint . --max-warnings=0`
- Unit/Logic: 6 Testdateien, 10 Tests bestanden
- Production Build: bestanden mit Next.js 16.2.9 und 12 generierten App-Routen
- Browser E2E: 18 Playwright-Tests bestanden auf Mobile Chrome und Desktop Chrome
- API Red-Team: ungültige Asset-Symbole und fehlerhafte Alert-Payloads liefern kontrolliert `400`
- Link-Audit: keine lokalen `undefined`-, `null`- oder `javascript:`-Links gefunden
- Form-Audit: Portfolio-Transaktion und alle professionellen Alert-Kategorien funktionieren in Mobile/Desktop-E2E
- PWA/Offline: Offline-Seite, Service Worker, Cache-Fallbacks und Reconnect-Update-Check geprüft
- Sprach-/Umlaut-Audit: bestanden, keine bekannten ASCII-Umlautreste in geprüften App-Dateien
- Sicherer Dependency-Audit: `npm audit --audit-level=high` bestanden

## Lasttest

Der Lasttest startet isoliert auf Port `3010`, nutzt den Production-Server, testet die Startseite und simuliert 1, 10, 25, 50, 100 und 200 gleichzeitige Requests.

| Gleichzeitige Nutzer | Requests | Rejected | HTTP/Slow Failures | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 0 | 0 | 14 ms | 14 ms | 14 ms |
| 10 | 10 | 0 | 0 | 142 ms | 157 ms | 157 ms |
| 25 | 25 | 0 | 0 | 87 ms | 99 ms | 99 ms |
| 50 | 50 | 0 | 0 | 120 ms | 169 ms | 169 ms |
| 100 | 100 | 0 | 0 | 170 ms | 274 ms | 277 ms |
| 200 | 200 | 0 | 0 | 289 ms | 533 ms | 564 ms |

Gesamtlaufzeit Lasttest: 1921 ms.

## Manuelle Browserprüfung

- Dashboard: Disclaimer sichtbar, Watchlist sichtbar, KI-Marktsentiment sichtbar, Marktübersicht vorhanden, keine kaputten Links, keine deaktivierten Buttons, keine zu kleinen Touch-Ziele in der geprüften Ansicht.
- Detailseite NVDA: Disclaimer sichtbar, KI-Einschätzung sichtbar, Chart-Zeiträume `1D`, `1W`, `1M`, `6M`, `1J`, `5J` sichtbar, Score-System sichtbar, Mock-/Delay-Hinweis sichtbar, keine kaputten Links, keine deaktivierten Buttons.
- Stale-Cache-Fund: Ein alter Service-Worker-/Dev-Server-Zustand lieferte vorher veraltete Texte. Behoben durch network-first Asset-Caching, Cache-Version `v2` und Service-Worker-Update beim Reconnect.

## Börsendaten-Richtigkeit

Aktuell werden bewusst Mock-Daten genutzt. Die App kennzeichnet diese Daten als Mock, Delay oder modellbasierte Einschätzung und verspricht keine Live-Richtigkeit. Eine echte fachliche Kursdatenvalidierung gegen Börsenplätze ist erst möglich, wenn ein Provider wie Finnhub, Alpha Vantage, Polygon.io, Twelve Data, Yahoo Finance oder NewsAPI mit API-Key angebunden ist.

## Offene Hinweise

- `npm audit` meldet weiterhin 2 moderate transitive Hinweise zu `postcss <8.5.10` über `next`. Der sichere Audit-Level `high` besteht. `npm audit fix --force` würde auf `next@9.3.3` downgraden und ist deshalb bewusst nicht angewendet.
- Die Lasttestwerte gelten lokal auf dieser Maschine und ersetzen kein Cloud-/Edge-Loadtest-Szenario mit echter CDN-, Datenbank- und API-Latenz.

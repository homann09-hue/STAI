# Red-Team Report

Stand: 2026-06-29

## Prüfziel

StockPilot AI wurde auf Funktion, PWA-Verhalten, Mobile/Desktop-Navigation, API-Robustheit, Performance, Sprachqualität, rechtliche Hinweise und Börsendaten-Darstellung geprüft. Ziel war nicht nur ein grüner Testlauf, sondern das Finden von Produktfehlern, stale Zuständen und missverständlichen Finanzsignalen.

## Gefundene und behobene Punkte

1. Stale Dev-Server/Hydration-Risiko

Ein alter Dev-Server auf Port `3000` lieferte eine Hydration-Abweichung zwischen altem Server-HTML und neuer Client-Version. Der Server wurde beendet, frisch gestartet und danach erneut geprüft.

2. PWA-Cache konnte statische Assets zu lange halten

Der Service Worker war für gleichoriginige statische Assets cache-first. Das konnte in Dev/PWA-Update-Szenarien alte Texte oder alte Client-Komponenten sichtbar halten. Behoben durch network-first Asset-Fetching mit Cache-Fallback, neue Cache-Versionen und Service-Worker-Update beim `online`-Event.

3. Dashboard-Beschriftung war nicht eindeutig genug

Die Marktübersichtsdaten waren vorhanden, aber es fehlte eine klare sichtbare Überschrift. Ergänzt wurde die Section-Beschriftung `Marktübersicht`.

4. Alert-E2E war zu wenig eindeutig

Die Alert-Liste konnte im Test mit anderen Textstellen kollidieren. Ergänzt wurden stabile `data-testid`-Anker für Alert-Liste und Alert-Regeln.

5. Lasttest war anfällig für vorhandene Dev-Server-Zustände

Der Lasttest prüft jetzt isoliert auf Port `3010` gegen den Production-Server, statt versehentlich einen bereits laufenden Dev-Server auf `3000` zu messen.

6. Sprachqualität hatte ASCII-Umlautreste

Mehrere sichtbare Texte in Scoring, Manifest, Mock-News und KI-Cases hatten ASCII-Umlautformen. Diese wurden korrigiert und der Grammatik-Audit wurde um Layout, Manifest und weitere Blockwörter erweitert.

7. Börsendaten könnten falsch verstanden werden

Da Mock-Daten genutzt werden, darf die App keine echte Kursdatenrichtigkeit behaupten. Die UI zeigt Mock-/Delay-/modellbasierte Hinweise und den rechtlichen Hinweis. Echte Kursvalidierung bleibt abhängig von späteren Datenanbietern.

## Finale Testergebnisse

- `npm run qa:redteam`: bestanden
- TypeScript: bestanden
- ESLint: bestanden ohne Warnungen
- Vitest: 6 Dateien, 10 Tests bestanden
- Next Production Build: bestanden
- Playwright: 18 Tests bestanden auf Mobile und Desktop
- Lasttest: bis 200 gleichzeitige Requests, 0 Rejections, 0 HTTP/Slow Failures, p95 bei 200 Requests: 533 ms
- Grammatik/Umlaut-Audit: bestanden
- Sicherer Dependency-Audit: keine High/Critical Findings

## Manuelle Browserbefunde

- Dashboard: Disclaimer, Watchlist, KI-Marktsentiment und Marktübersicht sichtbar.
- Detailseite: Kurs-/Chart-Zeiträume, Scores, technische/fundamentale Blöcke, KI-Einschätzung und Mock-/Delay-Hinweise sichtbar.
- Navigation: keine kaputten lokalen Links in geprüften Browser- und E2E-Routen.
- Buttons: keine deaktivierten oder zu kleinen geprüften Touch-Ziele in den geprüften Views.

## Nicht als erledigt behaupten

- Keine echte Live-Kursdatenprüfung, solange keine realen Provider-Keys angebunden sind.
- Keine echte Anlageberatung. Alle Scores und KI-Wahrscheinlichkeiten bleiben algorithmische Schätzungen ohne Garantie.
- Kein Cloud-Loadtest mit Supabase, echten Finanz-APIs und CDN-Kanten. Der aktuelle Lasttest ist lokal und isoliert.
- Moderate transitive `postcss`-Advisory über `next` bleibt beobachtet; ein erzwungener Fix würde aktuell einen gefährlichen Next-Downgrade auslösen.

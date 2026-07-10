# Test Report

## Baseline

- Typecheck: bestanden vor Änderungen.
- ESLint: bestanden vor Änderungen.
- Unit/Integration: 99/99 bestanden vor Änderungen.
- Coverage: 85,01 % Statements, 72,82 % Branches, 87,30 % Functions, 88,82 % Lines.
- Enterprise Readiness: 99/100, einziger Hinweis war der ohne URL übersprungene Livecheck.
- Grammatik/Umlaute: keine Findings.

## Ergänzte Regressionen

- KI-Quelltext- und Tokenbegrenzung.
- Überdimensionierte KI-Antwort.
- Lokaler Überverkauf verändert Position nicht.
- pgTAP: RLS-Isolation, Funktionsrechte, Unique-Indizes, atomarer Buy und abgewiesener Oversell.
- E2E-Abdeckung umfasst Navigation, mobile Ansichten, Offline, Streams und zentrale Seiten.

## Ausführungsgrenzen

- Lokale Datenbanktests benötigen Docker; sie werden im neuen isolierten GitHub-Workflow ausgeführt.
- Lasttests verwenden lokale App-/Mock-/Cachepfade und greifen nicht aggressiv auf Drittanbieter oder Produktion zu.
- Ein externer Penetrationstest und echte Geräte-/Browserfarm bleiben separate Prüfungen.

## Finaler Abschlusslauf am 10.07.2026

- Production Build: bestanden, 28 statische Seiten erfolgreich erzeugt.
- TypeScript: bestanden, keine Fehler.
- ESLint: bestanden, keine Warnungen.
- Unit-Tests: 104/104 bestanden in 21 Testdateien.
- Coverage: 85,04 % Statements, 73,43 % Branches, 87,08 % Funktionen, 88,82 % Zeilen.
- Playwright komplett: 31 bestanden, 1 erwartungsgemäß übersprungen, 0 fehlgeschlagen.
- Deep Browser Redteam: 16/16 bestanden auf Desktop und Mobile.
- Load-Test: bis 2.000 aktive Nutzer, 0 abgewiesene Requests, 0 HTTP-/SLO-Fehler; p95 13.373 ms bei 2.000.
- Stress-Test: gestuft bis 2.000 aktive Nutzer, 0 abgewiesene Requests, 0 Retries, 0 HTTP-/SLO-Fehler; p95 12.448 ms bei 2.000.
- Chaos-Test: Mock-Fallback, fehlender Provider-Key, Provider-Deadline, deaktivierter Krypto-Provider und Rate-Limit bestanden.
- npm Audit: 0 bekannte Schwachstellen ab moderate/high.
- Supabase Security Advisor: 0 Findings.
- Lokaler pgTAP-Lauf: Infrastruktur-blockiert, weil Docker Desktop nicht installiert ist. Derselbe Integritätsvertrag wurde gegen das STAI-Projekt transaktional geprüft; die CI-Datei startet dafür künftig eine isolierte Supabase-Instanz.

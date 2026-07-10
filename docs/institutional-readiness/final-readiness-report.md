# Final Institutional Readiness Report

Stand: 10.07.2026

## 1. Executive Summary

StockPilot AI ist **pilot_ready_with_restrictions**. Der Repository-Stand besitzt belastbare technische Grundlagen für einen kontrollierten, nicht produktionskritischen Pilot: RLS, atomare Portfoliointegrität, Data-Quality-Quarantäne, versionierte Intelligence, reproduzierbare Analysen, Modellbenchmark, kontrollierte Provider-Degradation, sichere API-Grenzen, SBOM und breite Tests.

Die Plattform ist nicht institutionell freigegeben. Ein Restore-Nachweis, aktives Enterprise-IAM, zentrale Observability, Multi-Region-Failover, externe Prüfungen und vollständige Datenlizenzverträge fehlen.

## 2. Geprüfter Umfang

Next.js/PWA, Capacitor-Grenze, API-Routen, Provideradapter, Supabase Auth/Schema/RLS, Intelligence-Pipeline, KI-Adapter, Portfolio/Alerts/Watchlist, Offline, CI/CD, Dependencies, Lizenzen, Performance, Resilience, DR-Dokumentation und Due-Diligence-Evidence.

## 3. Architekturzustand

Modularer BFF-/Provideransatz mit Supabase als System of Record. Kritische Single Points of Failure sind Supabase-Region, Vercel-Konfiguration und fehlende durable Shared Queue/Cache. Systemmodell: `system-architecture.md`.

## 4. Reifegrad pro Domäne

26 Domänen wurden auf Skala 0-5 bewertet. Höchster Wert ist 4 für Informationssicherheit; IAM, HA, DR, BCP, Observability, Incident, Compliance, Provider und Lizenz liegen bei 1-3. Kein Reifegrad 5 wurde vergeben. Details: `maturity-assessment.md`.

## 5. Verifizierte frühere Fixes

Portfolio-Oversell/Race, Composite Owner-FKs, RLS, Secretgrenzen, Timing-safe Adminauth, KI-Größenlimits, Realtime-Queue, Service-Worker-Race, Mobile Touch Targets, Account Export/Löschung, Mock/Live-Trennung und Dependency-CVEs sind technisch verifiziert. Details: `previous-audit-verification.md`.

## 6. Neue Befunde

- Deterministisches Modell wiederholte ein unseriöses Renditeversprechen aus Social-Quelltext in der Zusammenfassung. Behoben durch Trennung von Originalbeleg und sicherem generiertem Titel.
- Vorher fehlten institutionelle Quarantäne, Audit-Hashkette, Reproduction-Historie, Model/Prompt Registry und Change Records. Implementiert in einer neuen Migration, noch nicht auf Produktion angewendet.
- Vorher fehlte ein 10.000-Session-Profil. Sicherer lokaler Test ergänzt und bestanden.
- Load-Harness bewertete einzelne Queue-Ausreißer statt p95-SLO. Auf p95 plus hartes Maximum korrigiert.

## 7. Behobene Critical Findings

Keine neue bestätigte Critical-Schwachstelle. Frühere P0-Portfoliointegrität und Cross-Tenant-FK-Probleme bleiben behoben. Ungültige/verbotene Intelligence-Daten werden vor Analyse/Alert quarantänisiert.

## 8. Behobene High Findings

- append-only Analyse-/Review-/Reproduction-Modell
- hashverketteter server-only Audit-Log
- explizite Rollen-/Separation-Regeln
- Reproduction Runner hinter starkem Adminsecret
- Modellversprechen aus untrusted Quellen neutralisiert
- SBOM/Evidence/Format/Performance-CI-Gates

High-Restpunkte: Restore, Enterprise-IAM, Providerverträge, SIEM/Tracing und Staging-Migrationstest.

## 9. Datenqualitätszustand

Acht Dimensionen, Pflichtmetadaten, Quarantäne und Pipeline-Gate sind implementiert und getestet. Fachlich plausible falsche Providerdaten können intern weiterhin unentdeckt bleiben; Cross-Provider-Abgleich und DQ-Dashboard fehlen.

## 10. Modellrisikozustand

18-Fälle-Corpus prüft Richtung, Human Review, Prompt Injection und verbotene Claims. Aktueller deterministischer Lauf besteht die internen Schwellen. Das beweist keine Prognosequalität und ersetzt keine unabhängige Model Validation.

## 11. Security-Kontrollen

CSP/HSTS, Validierung, Rate Limits, Body-/Response-Limits, Same-Origin, serverseitige Keys, Redaction, RLS, Composite FKs, Auditmodell, Secret Scan und Least-Privilege-CI. Kein externer Penetrationstest oder WORM-Archiv.

## 12. Mandantentrennung

Aktive Endnutzerdaten sind über `user_id`-RLS und Negativtests getrennt. Das Organisationsschema ist fail-closed vorbereitet; Tenantmutation, SSO/SCIM und Teamfunktionen sind nicht aktiv. Tenant-Identifier werden nicht aus ungeprüftem Clientbody vertraut.

## 13. Verfügbarkeit

Provider-Fallback, Cache, Offline, Delayed/Mock-Status, Reconnect und deterministischer KI-Fallback. Kein verifizierter Multi-Region-Failover und kein Live-Shared-Cache.

## 14. Disaster Recovery

DR-Smoke und Runbook bestehen. Vollständiger Restore ist nicht nachgewiesen; daher keine institutionelle Freigabe.

## 15. Provider-Risiken

Provider sind entkoppelt und statusklar. FMP/Coinbase/News/Realtime-Redistribution und institutionelle Börsenrechte müssen schriftlich geklärt werden. Supabase und Vercel bleiben kritische Plattformabhängigkeiten.

## 16. Performance

- JS: 1.600.706 Bytes bei Budget 2.097.152.
- 2.000 Load: p95 14.396 ms, max 14.547 ms, 0 Fehler.
- 2.000 Stress: p95 12.280 ms, p99 12.651 ms, 0 Fehler/Retry.
- Sequenziell vor Erweiterung: Dashboard p95 330 ms, Health 4 ms, Quotes 2 ms, Intelligence 126 ms.

Lokale Werte sind kein Produktions-SLA.

## 17. Skalierung

10.000 lokale Sessions mit 128 Origin-Workern: 10.000/10.000, 0 Fehler, 0 Retries, p95 1.287 ms, p99 2.139 ms, 382 Requests/s. Das Profil nutzt interne/Mock-Pfade und CDN-ähnliche Gewichtung; es simuliert nicht 10.000 gleichzeitige WebSockets.

## 18. Kostenkontrollen

KI-Token/Bytes, Semaphore, Provider-TTL, Batching, Backoff, Streamintervalle und Budget-Hard-Stop-Modell. Produktive Tenantkosten und FinOps-Alerts fehlen.

## 19. Compliance-Lücken

Keine Rechtskonformität wird behauptet. Juristische Einordnung, MiFID/Finanzwerbung, Datenschutz-Folgenabschätzung, AVVs, Aufbewahrung und regulatorische Verantwortlichkeiten sind extern zu prüfen.

## 20. Lizenzrisiken

npm Audit: 0 bekannte CVEs. Lizenzscan markiert ausschließlich transitive sharp/libvips-LGPL-Artefakte zur Review. Marktdaten- und Newsverträge bleiben wesentliches Restrisiko.

## 21. Testergebnisse

- Format, Typecheck, ESLint, Production Build: bestanden.
- Unit/Coverage: 113/113, 24 Dateien.
- Coverage: 85,27 % Statements, 75,16 % Branches, 88,00 % Funktionen, 88,96 % Zeilen.
- Data Quality fokussiert: 11/11.
- Modellbenchmark: 18 Fälle, bestanden.
- Playwright: 31 bestanden, 1 erwarteter Desktop-Skip.
- Load, Stress, 10k Capacity, Chaos und DR-Smoke: bestanden.
- npm Audit moderate/high: 0 Findings.
- Grammar/Umlaute: bestanden.
- Lokaler pgTAP: blockiert, keine laufende Docker-Postgres-Instanz.

## 22. Nachweise

CycloneDX-SBOM, Modellbenchmark, Hashmanifest, Migrationen, pgTAP-Verträge, CI-Workflows, Load/Stress/Chaos-Ausgaben und Due-Diligence-Dokumente. Nachweise sind automatisch erzeugt, nicht extern attestiert.

## 23. Bekannte Restrisiken

Restore, Multi-Region, Shared Cache/Queue, Enterprise-IAM, SIEM/Tracing, On-call, Providerverträge, juristische Prüfung, externe Security-/Model-Validation, Browser-/Device-Labor und Legacy-Analysen ohne Snapshot.

## 24. Offene Blockaden

- Docker/Staging-Branch für neue Migration und pgTAP.
- Supabase/Vercel/Provider-Verträge und Kostenfreigaben.
- Upstash oder gleichwertiger Shared Cache.
- organisatorische Owner, On-call und Reviewrollen.

## 25. Organisatorische Anforderungen

Security, Data Owner, Model Risk Owner, Privacy, Compliance, Operations, Release Manager und Incident Commander benennen. Rollen müssen getrennt, regelmäßig rezertifiziert und trainiert werden.

## 26. Juristisch zu prüfende Punkte

Marktdatenredistribution, Newsarchivierung, KI-Datenverarbeitung, Finanzwerbung/Anlageberatung, Nutzungsbedingungen, DPIA/AVV, Retention/Löschung, Datenstandort und Incident-Meldepflichten.

## 27. Bedingungen für Enterprise-Pilotkunden

1. Neue Migration in isolierter Staging-Umgebung anwenden und beide pgTAP-Suites bestehen.
2. Backup-Restore und Rollback praktisch nachweisen.
3. Alle früher geteilten Secrets rotieren.
4. Providerrechte schriftlich bestätigen.
5. SSO/MFA oder klar begrenzte Pilotidentitäten mit Reauth einführen.
6. Shared Cache, Monitoring, SIEM-Export und On-call aktivieren.
7. Pilotvertrag begrenzt Scope, SLA, Datenklassen und keine Anlageberatung.

## 28. Priorisierte nächste Maßnahmen

- P0: Staging-Migration/pgTAP, Restore-Drill, Secretrotation, Providerrechte.
- P1: SSO/MFA/SCIM, SIEM/Tracing, Shared Cache/Queue, DQ-Dashboard, unabhängige Modell-/Securityprüfung.
- P2: Canary, signierte Provenienz, API v1, Auditexport, kundenspezifische Retention/Data Residency.

## Ehrliche Bewertung

**pilot_ready_with_restrictions**

Nicht `enterprise_pilot_ready`, weil Restore, Staging-Migration, Enterprise-IAM, zentrale Observability und Verträge nicht vollständig nachgewiesen sind. Nicht `institutional_review_ready`, weil mehrere technische Abnahmekriterien und unabhängige Verifikationen fehlen.

# Institutionelles Reifegrad-Assessment

Skala: 0 nicht vorhanden, 1 ad hoc, 2 teilweise definiert, 3 implementiert, 4 getestet und überwacht, 5 institutionell belastbar und regelmäßig unabhängig verifiziert.

Kein Bereich erhält Stufe 5. Eine interne technische Prüfung ist keine unabhängige Zertifizierung.

| Domäne | Ist | Ziel | Kritische Lücke | Technischer Nachweis |
| --- | ---: | ---: | --- | --- |
| Unternehmensarchitektur | 3 | 4 | Kein separater Queue-Dienst | Provider-Schichten, Architekturmodell |
| Informationssicherheit | 4 | 4 | Externer Penetrationstest | Security Headers, Secret Scan, Advisor |
| IAM | 2 | 4 | SSO/SCIM/MFA fehlen | Supabase Auth, Rollenmodell |
| Mandantentrennung | 3 | 4 | Organisationsmodus nicht aktiv | user_id-RLS, Negative Tests |
| Datenqualität | 3 | 4 | Kein produktives DQ-Dashboard | 8 Dimensionen, Quarantäne, Tests |
| Lineage | 3 | 4 | Kein externer Katalog | Raw/Normalized/Analysis IDs |
| Markt-/Referenzdaten | 3 | 4 | Börsenlizenzen | Qualitätsbadges, Provider-Fallback |
| KI-/Modellrisiko | 3 | 4 | Unabhängige Validierung | Corpus, Inventory, Human Review |
| Reproduzierbarkeit | 3 | 4 | Legacy-Snapshots fehlen | Input-Snapshot, Runner |
| Nachvollziehbarkeit | 3 | 4 | Kein WORM-Archiv | Hash-Auditlog, append-only Analysen |
| Hochverfügbarkeit | 2 | 4 | Kein Multi-Region-Failover | Managed Runtime, Degraded Mode |
| Skalierbarkeit | 3 | 4 | 10k/Shared Cache offen | 2k Load/Stress, Cache |
| Disaster Recovery | 2 | 4 | Restore nicht ausgeführt | Runbook, DR Smoke |
| Business Continuity | 2 | 4 | Organisatorische Übung | Fallback/Offline |
| Change Management | 3 | 4 | Externe Branchregeln | CI, Change Records |
| Release Management | 3 | 4 | Kein Canary | Manueller Production Gate |
| Supply Chain | 3 | 4 | Signierte Provenienz | Lockfile, Audit, SBOM |
| Observability | 2 | 4 | Metrics/Tracing/SIEM fehlen | Logs, Health, Providerstatus |
| Incident Management | 2 | 4 | On-call/Übungen fehlen | Incident Runbook |
| Finanz-Compliance | 2 | 4 | Juristische Prüfung | Disclaimer, Claim-Tests |
| Datenschutz | 3 | 4 | DPIA/AVV offen | Export, Löschung, RLS |
| Provider-Risiko | 2 | 4 | Verträge/Exit-Tests | Providerregister, Fallbacks |
| Kostenkontrolle | 3 | 4 | Live-Tenant-Abrechnung | Tokenlimit, TTL, Kill-Switch-Modell |
| Enterprise-Integration | 1 | 3 | SSO/SCIM/SIEM nicht aktiv | Interfaces, Flags deaktiviert |
| Vertrags-/Lizenzfähigkeit | 2 | 4 | Redistributionsrechte | Lizenzregister |
| Audit-/DD-Fähigkeit | 3 | 4 | Unabhängige Attestation | Evidence Pack, Control Matrix |

## Bewertungslogik

Stufe 4 wird nur dort vergeben, wo Implementierung, automatisierter Test und wiederholbarer Nachweis vorhanden sind. Monitoringlücken begrenzen die meisten Domänen auf Stufe 3 oder niedriger.

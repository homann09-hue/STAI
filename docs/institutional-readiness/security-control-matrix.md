# Security Control Matrix

| ID | Risiko/Kontrolle | Implementierung | Test/Nachweis | Owner/Frequenz | Status/Restrisiko |
| --- | --- | --- | --- | --- | --- |
| IAM-01 | fremde Nutzerdaten | `user_id` RLS | pgTAP Negativtests | Security/jeder PR | implementiert; Orgmodus offen |
| IAM-02 | Rollenkonflikt | Rollenmatrix, eine Tenantrolle | Unit-Test | Security/Quartal | vorbereitet; SSO fehlt |
| AUTH-01 | Admin-Secret Timing | SHA-256 + timingSafeEqual | Unit/Code | Security/jeder PR | implementiert |
| API-01 | Abuse/DoS | Read/Mutation Rate Limit | Chaos 429 | Operations/jeder Release | Memory nicht verteilt |
| API-02 | Injection/XSS | Zod, Symbolsanitize, CSP | E2E/Unit | Engineering/jeder PR | externe Payloadrisiken bleiben |
| SEC-01 | Secret Leak | Serverkeys, Redaction, Scan | Enterprise Check | Security/jeder PR | Schlüsselrotation extern |
| SEC-02 | Response Leak | sichere Fehler, Byte-Limits | Unit/Chaos | Engineering/jeder PR | Providerfehler möglich |
| DQ-01 | falsche Daten | 8 Dimensionen + Quarantäne | DQ Tests | Data Ops/fortlaufend | Cross-Provider-Abgleich offen |
| AI-01 | Prompt Injection | untrusted boundary + Schema | Model Corpus | Model Risk/Modellwechsel | LLM-Restfehler |
| AI-02 | nicht reproduzierbar | Snapshot/Hashes/Versionen | Reproduction Test | Model Risk/Release | Legacy unverified |
| AUD-01 | Audit-Manipulation | append-only + Hashkette | pgTAP Trigger | Security/Release | kein externes WORM |
| AUD-02 | sensible Logs | Redaction/Größenlimits | Observability Tests | Security/jeder PR | Fehlklassifikation möglich |
| DATA-01 | Portfolio-Race | atomare RPC + Advisory Lock | DB-Test | Engineering/Migration | Brokerquelle fehlt |
| DATA-02 | Cross-Tenant FK | Composite Owner-FKs | DB-Test | Security/Migration | neue Tabellen prüfen |
| PRIV-01 | Betroffenenrechte | Export/Löschung | API/E2E | Privacy/Quartal | rechtliche Fristen offen |
| SUP-01 | Supply Chain | Lockfile, npm Audit, Lizenz, SBOM | CI Artifact | Engineering/jeder PR | Actions nicht SHA-gepinnt |
| DR-01 | Ausfall/Datenverlust | Runbooks/Backups | Smoke Drill | Operations/Quartal | Restore nicht belegt |
| REL-01 | unkontrolliertes Prod | manuelles Gate + Bestätigung | Workflow | Release/jeder Deploy | Branchregeln extern |
| COST-01 | Kostenexplosion | Token-/Byte-Limits, TTL, Budgetmodell | Unit | FinOps/monatlich | Live-Kostenfeed fehlt |
| FIN-01 | irreführende Claims | Disclaimer + Claim Scanner | Grammar/Unit | Compliance/jeder PR | juristische Prüfung offen |

Kein Matrixeintrag ist eine Zertifizierung. Verantwortliche Rollen müssen organisatorisch konkret benannt werden.

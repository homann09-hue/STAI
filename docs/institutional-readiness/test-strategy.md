# Teststrategie

## Pyramide

- Unit: Validierung, Scoring, Risiko, DQ, Rollen, Kosten, Lineage.
- Integration/Contract: Provideradapter, HTTP-Limits, Modelloutputschema.
- Database/RLS: Mandantentrennung, FKs, RPC, Immutable Controls.
- E2E: Desktop, Mobile, Offline/PWA, Navigation, Formulare, Datenwahrheit.
- Security: Secret Scan, Header, Same-Origin, XSS, Rate Limit.
- Model Validation: 18 adversariale/semantische Fälle pro Version.
- Performance/Resilience: Load, Stress, Chaos, DR Smoke.

## Release Gates

Format, Typecheck, Lint, Coverage, Lizenz, CVE, SBOM, Build, pgTAP, Browser und Evidence. High-Risk-Änderungen benötigen zusätzlich Migration-Dry-Run, Rollback-/Restoreplan, Security- und Performance-Review.

## Nicht vollständig abgedeckt

Echter Multi-Region-Failover, 10.000 sichere Sessions, vollständiger Backup-Restore, Browsermatrix außerhalb Chromium, natives iOS-Gerätelabor und externe Penetrationstests.

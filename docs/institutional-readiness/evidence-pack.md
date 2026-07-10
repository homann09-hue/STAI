# Evidence Pack

`npm run evidence:generate` erzeugt:

- CycloneDX 1.5 SBOM
- Hashmanifest relevanter Controls
- Modellbenchmark aus dem Produktions-Regelmodell
- Verweise auf RLS-/Migrationstests

Test-, Load-, Stress-, Chaos-, DR-, Lizenz- und Audit-Ausgaben werden durch CI erzeugt. Das Pack ist `generated_not_attested`, enthält keine Produktionsdaten und ersetzt keine unabhängige Prüfung. Backup-/Restore-Evidence bleibt bis zu einem isolierten Drill offen.

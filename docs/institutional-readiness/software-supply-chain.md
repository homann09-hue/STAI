# Software Supply Chain

## Implementiert

- npm Lockfile und gepinnte direkte Versionen.
- Node/npm-Version vertraglich begrenzt.
- Typecheck, Lint, Coverage, Build, Browser-, DB-, Grammar- und Audit-Gates.
- npm CVE-Scan und eigener Lizenzscan.
- CycloneDX 1.5 SBOM ohne Produktionsdaten.
- Secret-Scan und Public-ENV-Grenze.
- CI `contents: read`, manuelle Production-Bestätigung, getrennte StockPilot-Secrets.
- Evidence-Artefakt mit 30 Tagen CI-Retention.

## Offen

- GitHub Actions sind auf Major Tags, nicht Commit-SHAs gepinnt.
- SLSA-/Sigstore-Provenienz und signierte Releases fehlen.
- Branch Protection und verpflichtende Reviewer sind Repository-Einstellungen und lokal nicht verifizierbar.
- Kein Container-Image im aktuellen Vercel-Deploy; daher kein Container-Scan. Supabase-Testcontainer wird durch offiziellen CLI-Workflow erzeugt.
- Preview-Produktionsdatentrennung muss in Vercel-ENV organisatorisch bestätigt werden.

## Abbruchkriterien

Critical/High CVE ohne akzeptierte Kompensation, unbekannte direkte Lizenz, Secret-Fund, fehlendes Lockfile oder fehlerhafte SBOM-Erzeugung blockieren die Freigabe.

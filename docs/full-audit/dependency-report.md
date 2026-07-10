# Dependency Report

## Ergebnis

- Paketmanager: npm 11 mit committed Lockfile und exakt gepinnten Versionen.
- npm Audit: 0 Critical, High, Moderate, Low oder Info-Vulnerabilities im Prüflauf.
- Capacitor CLI wurde korrekt in `devDependencies` verschoben.
- Node ist auf `>=22 <25` begrenzt, um unbeabsichtigte künftige Major-Upgrades zu verhindern.

## Veraltete Pakete

- Patchupdates existieren für Next.js, Supabase JS, Vitest und PostCSS; kein ungeprüftes Sammelupgrade wurde durchgeführt.
- Majorupdates für ESLint, Tailwind, TypeScript und Lucide erfordern eigene Migrationen und sind kein Sicherheitsfix.

## Lizenzen

- Direkte Laufzeitpakete verwenden permissive Lizenzen.
- Next.js bringt Sharp/libvips-Plattformpakete mit LGPL-3.0-or-later transitiv mit; Distributions- und Notice-Pflichten juristisch prüfen.
- `caniuse-lite` verwendet CC-BY-4.0 transitiv im Buildprozess.
- `npm run audit:licenses` erzeugt eine reproduzierbare Prüfliste und schlägt bei direkten AGPL-/SSPL-/proprietären/unklaren Lizenzen fehl.

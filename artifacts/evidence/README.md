# StockPilot AI Evidence Pack

Dieser Ordner enthält automatisch erzeugbare technische Nachweise. Dateien mit Zeitstempel sind keine Zertifizierung und nicht kryptografisch durch eine externe Stelle attestiert.

Erzeugung:

```bash
npm run test:model
npm run evidence:generate
```

Enthalten sind CycloneDX-SBOM, Modellbenchmark und ein Hash-Manifest. Secrets und Produktionsdaten dürfen hier nicht gespeichert werden.

# Changelog

Alle wesentlichen Produkt-, Sicherheits- und Architekturänderungen werden hier dokumentiert.

## 2026-07-11

### Added

- Fail-closed Stripe Checkout und Customer Portal hinter Supabase Auth.
- Signaturgeprüfter Raw-Body-Webhook mit idempotentem, unveränderlichem Billing-Nachweis.
- Serverseitige Entitlement-Auflösung und atomare Planlimits für Watchlists, Alerts und Portfolio-Books.
- Dynamischer, verifizierter Planstatus in Pricing und App-Shell.
- Billing-ADR, Betriebsanleitung, Unit-, E2E- und pgTAP-Tests.

### Security

- Keine Stripe-Secrets oder Provider-IDs im Client.
- Keine Freischaltung durch Clientwerte oder ungeprüfte Metadaten.
- Sichere Stripe-Redirect-Allowlist und fail-closed Fehlerzustände.

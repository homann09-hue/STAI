export type InstitutionalReadinessRating =
  | "not_ready"
  | "pilot_ready_with_restrictions"
  | "enterprise_pilot_ready"
  | "institutional_review_ready";

export type MaturityDomain = {
  id: string;
  name: string;
  current: 0 | 1 | 2 | 3 | 4 | 5;
  target: 0 | 1 | 2 | 3 | 4 | 5;
  evidence: string[];
  gaps: string[];
};

export const maturityDomains: MaturityDomain[] = [
  { id: "architecture", name: "Unternehmensarchitektur", current: 3, target: 4, evidence: ["Provider-Abstraktion", "System- und Trust-Boundary-Dokumentation"], gaps: ["Kein separater Queue-Dienst"] },
  { id: "security", name: "Informationssicherheit", current: 4, target: 4, evidence: ["Security Headers", "Secret Scan", "Supabase Advisor"], gaps: ["Externe Penetrationstests fehlen"] },
  { id: "iam", name: "Identitäts- und Zugriffsmanagement", current: 2, target: 4, evidence: ["Supabase Auth", "Rollenmodell vorbereitet"], gaps: ["MFA, SSO, SCIM und privilegierte Sessions nicht aktiv"] },
  { id: "tenant", name: "Mandantentrennung", current: 3, target: 4, evidence: ["user_id-RLS", "Negative RLS-Tests", "Organisationsschema vorbereitet"], gaps: ["Organisationsfunktionen nicht produktiv freigeschaltet"] },
  { id: "data_quality", name: "Datenqualität", current: 3, target: 4, evidence: ["Acht Qualitätsdimensionen", "Quarantäneentscheidung", "Tests"], gaps: ["Produktions-DQ-Dashboard fehlt"] },
  { id: "lineage", name: "Datenherkunft und Lineage", current: 3, target: 4, evidence: ["Raw/Normalized/Analysis IDs", "Versionen und Hashes"], gaps: ["Externe Lineage-Plattform fehlt"] },
  { id: "market_data", name: "Markt- und Referenzdaten", current: 3, target: 4, evidence: ["Provider und Qualitätsbadges", "Fallbacks"], gaps: ["Institutionelle Börsenlizenzen fehlen"] },
  { id: "model_risk", name: "KI- und Modellrisiko", current: 3, target: 4, evidence: ["Model Inventory", "Deterministischer Benchmark", "Human Review Regeln"], gaps: ["Unabhängige Modellvalidierung fehlt"] },
  { id: "reproducibility", name: "Reproduzierbarkeit", current: 3, target: 4, evidence: ["Input Snapshot", "Reproduction Runner", "Driftvergleich"], gaps: ["Historische Provider-Payloads unterliegen Retention"] },
  { id: "traceability", name: "Nachvollziehbarkeit", current: 3, target: 4, evidence: ["Append-only Analysen", "Hashverkettete Audit-Events"], gaps: ["Externes WORM-Archiv fehlt"] },
  { id: "availability", name: "Hochverfügbarkeit", current: 2, target: 4, evidence: ["Vercel/Supabase Managed Runtime", "Degraded Modes"], gaps: ["Kein verifizierter Multi-Region-Failover"] },
  { id: "scalability", name: "Skalierbarkeit", current: 3, target: 4, evidence: ["2.000-Nutzer-Tests", "Caching und Batching"], gaps: ["10.000-Sessions-Test und Shared Cache fehlen"] },
  { id: "dr", name: "Disaster Recovery", current: 2, target: 4, evidence: ["DR Runbook", "Smoke Drill"], gaps: ["Isolierter Restore-Test nicht durchgeführt"] },
  { id: "bcp", name: "Business Continuity", current: 2, target: 4, evidence: ["Provider-Fallbacks", "Offline-Modus"], gaps: ["Organisatorische Bereitschaftsübung fehlt"] },
  { id: "change", name: "Change Management", current: 3, target: 4, evidence: ["CI Gates", "Change-Record-Schema"], gaps: ["Branch Protection extern zu verifizieren"] },
  { id: "release", name: "Release Management", current: 3, target: 4, evidence: ["Manueller Production Gate", "Rollback-Dokumentation"], gaps: ["Canary-Rollout nicht aktiv"] },
  { id: "supply_chain", name: "Software Supply Chain", current: 3, target: 4, evidence: ["Lockfile", "Audit", "Lizenzprüfung", "CycloneDX SBOM"], gaps: ["Signierte Provenienz und SHA-gepinnte Actions fehlen"] },
  { id: "observability", name: "Beobachtbarkeit", current: 2, target: 4, evidence: ["Strukturierte Logs", "Health und Providerstatus"], gaps: ["Zentrales Metrics/Tracing Backend fehlt"] },
  { id: "incident", name: "Incident Management", current: 2, target: 4, evidence: ["Runbook und Severity-Modell"], gaps: ["On-call und Übungen organisatorisch offen"] },
  { id: "financial_compliance", name: "Finanzbezogene Compliance", current: 2, target: 4, evidence: ["Disclaimer", "Verbotene Claims Test"], gaps: ["Juristische Prüfung und regulatorische Einordnung fehlen"] },
  { id: "privacy", name: "Datenschutz", current: 3, target: 4, evidence: ["Export", "Löschung", "RLS", "Datenminimierung"], gaps: ["DPIA und AVV-Prüfung fehlen"] },
  { id: "provider_risk", name: "Drittanbieter- und Provider-Risiko", current: 2, target: 4, evidence: ["Provider Register", "Fallbacks"], gaps: ["Verträge, SLAs und Exit-Tests fehlen"] },
  { id: "cost", name: "Kostenkontrolle", current: 3, target: 4, evidence: ["Tokenlimits", "Cache TTL", "Budget-Kill-Switch Modell"], gaps: ["Abrechnungsdaten pro Tenant fehlen"] },
  { id: "integration", name: "Enterprise-Integration", current: 1, target: 3, evidence: ["Interfaces und sichere Feature Flags"], gaps: ["SSO, SCIM, SIEM und Service Accounts nicht aktiv"] },
  { id: "licensing", name: "Vertrags- und Lizenzfähigkeit", current: 2, target: 4, evidence: ["Lizenzregister", "Datenstatus"], gaps: ["Marktdaten-Redistributionsrechte fehlen"] },
  { id: "audit", name: "Audit- und Due-Diligence-Fähigkeit", current: 3, target: 4, evidence: ["Evidence Generator", "Control Matrix", "Audit Log"], gaps: ["Unabhängige Prüfung fehlt"] }
];

export const institutionalReadiness = {
  rating: "pilot_ready_with_restrictions" as InstitutionalReadinessRating,
  assessedAt: "2026-07-10",
  claim: "Technisch für einen kontrollierten Pilot vorbereitet, nicht institutionell freigegeben.",
  blockers: [
    "Kein nachgewiesener Restore in einer isolierten Nicht-Produktionsumgebung.",
    "SSO, SCIM, MFA und organisatorische Rollentrennung sind nicht produktiv aktiv.",
    "Provider- und Redistributionsverträge sind nicht vollständig nachgewiesen.",
    "Zentrales SIEM, Tracing, On-call und Multi-Region-Failover fehlen."
  ],
  domains: maturityDomains
};

import { existsSync, readFileSync, readdirSync } from "node:fs";

const checks = [];
function pass(name, detail) { checks.push({ name, status: "pass", detail }); }
function fail(name, detail) { checks.push({ name, status: "fail", detail }); }
function content(path) { return existsSync(path) ? readFileSync(path, "utf8") : ""; }
function requireFile(path, name = path) {
  if (existsSync(path)) pass(name, path);
  else fail(name, `missing ${path}`);
}
function requireText(path, patterns, name) {
  const source = content(path);
  const missing = patterns.filter((pattern) => !source.includes(pattern));
  if (missing.length) fail(name, `missing controls: ${missing.join(", ")}`);
  else pass(name, path);
}

const requiredCoreDocs = [
  "previous-audit-verification.md", "maturity-assessment.md", "system-architecture.md", "data-flow.md",
  "trust-boundaries.md", "data-quality-framework.md", "model-inventory.md", "security-control-matrix.md",
  "software-supply-chain.md", "disaster-recovery.md", "incident-management.md", "test-strategy.md",
  "local-database-validation.md"
];
for (const file of requiredCoreDocs) requireFile(`docs/institutional-readiness/${file}`, `document:${file}`);

const dueDiligenceDir = "docs/institutional-readiness/due-diligence";
const dueDiligenceFiles = existsSync(dueDiligenceDir) ? readdirSync(dueDiligenceDir).filter((file) => file.endsWith(".md")) : [];
if (dueDiligenceFiles.length >= 16) pass("due diligence data room", `${dueDiligenceFiles.length} documents`);
else fail("due diligence data room", `${dueDiligenceFiles.length}/16 documents`);

const adrDir = "docs/institutional-readiness/adrs";
const adrFiles = existsSync(adrDir) ? readdirSync(adrDir).filter((file) => /^ADR-\d+.*\.md$/.test(file)) : [];
if (adrFiles.length >= 17) pass("architecture decision records", `${adrFiles.length} ADRs`);
else fail("architecture decision records", `${adrFiles.length}/17 ADRs`);

requireText("src/lib/institutional/data-quality.ts", ["completeness", "correctness", "timeliness", "consistency", "uniqueness", "plausibility", "provenance", "reproducibility", "quarantined"], "institutional data quality dimensions");
requireText("src/lib/institutional/governance.ts", ["security_administrator", "tenant_administrator", "service_account", "auditor", "validateRoleCombination", "evaluateCostBudget"], "roles, separation and cost controls");
requireText("src/lib/institutional/reproduction.ts", ["input_snapshot", "compareReproduction", "analysis_reproduction_runs", "append_institutional_audit_event"], "analysis reproduction runner");
requireText("src/app/api/intelligence/reproduce/route.ts", ["hasPrivilegedAccess", "analysis_reproduction", "requireSameOrigin", "rateLimit"], "protected reproduction API");
requireText("supabase/migrations/20260630132652_stockpilot_initial_schema.sql", ["create table if not exists public.profiles", "create table if not exists public.watchlists", "create table if not exists public.portfolio_positions", "enable row level security"], "canonical database bootstrap");
requireText("supabase/migrations/20260710221030_add_institutional_governance_controls.sql", ["institutional_audit_log", "data_quality_quarantine", "institutional_memberships", "enable row level security", "institutional_audit_immutable", "intelligence_analysis_immutable", "revoke execute", "analysis_reproduction_runs"], "institutional migration controls");
requireText("supabase/migrations/20260710221046_harden_institutional_governance_indexes_and_policies.sql", ["analysis_reproduction_runs_requested_by_idx", "institutional_memberships_granted_by_idx", "Server-only institutional access denied"], "institutional advisor remediation");
requireText("supabase/tests/database/institutional_controls.test.sql", ["plan(25)", "server-only institutional tables", "authenticated clients cannot append fabricated audit events", "analysis history has immutable trigger", "explicit deny policies"], "institutional database contract tests");
requireText(".github/workflows/ci.yml", ["format:check", "audit:licenses", "evidence:generate", "upload-artifact", "performance:budget"], "institutional CI evidence gates");
requireText(".github/workflows/capacity.yml", ["10,000", "test:capacity", "STOCKPILOT_MARKET_PROVIDER: mock"], "safe local capacity workflow");

const readiness = content("src/lib/institutional/readiness.ts");
if (readiness.includes('rating: "pilot_ready_with_restrictions"') && !readiness.includes('rating: "institutional_review_ready"')) {
  pass("honest readiness rating", "pilot_ready_with_restrictions");
} else {
  fail("honest readiness rating", "rating is missing or overstated");
}

try {
  const sbom = JSON.parse(content("artifacts/evidence/sbom.cdx.json"));
  if (Array.isArray(sbom.components) && sbom.components.length > 0) {
    pass("CycloneDX SBOM", `${sbom.components.length} components`);
  } else {
    fail("CycloneDX SBOM", "no components");
  }
} catch {
  fail("CycloneDX SBOM", "invalid or missing JSON");
}

try {
  const evidence = JSON.parse(content("artifacts/evidence/evidence-manifest.json"));
  if (evidence.containsProductionData === false && evidence.status === "generated_not_attested") {
    pass("evidence safety", `${evidence.evidence?.length ?? 0} hashed entries`);
  } else {
    fail("evidence safety", "manifest is missing caveat or production-data guard");
  }
} catch {
  fail("evidence safety", "invalid or missing JSON");
}

console.table(checks);
const failures = checks.filter((check) => check.status === "fail");
console.log(`Institutional control result: ${checks.length - failures.length}/${checks.length} passed.`);
if (failures.length) process.exit(1);

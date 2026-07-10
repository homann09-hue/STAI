import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const root = process.cwd();
const outputDir = `${root}/artifacts/evidence`;
mkdirSync(outputDir, { recursive: true });
const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, "utf8"));
const generatedAt = new Date().toISOString();

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const componentsByRef = new Map();
for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path || !metadata || typeof metadata !== "object" || !metadata.version) continue;
  const marker = "node_modules/";
  const markerIndex = path.lastIndexOf(marker);
  const name = metadata.name || (markerIndex >= 0 ? path.slice(markerIndex + marker.length) : basename(path));
  if (!name) continue;
  const version = String(metadata.version);
  const ref = `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
  if (componentsByRef.has(ref)) continue;
  componentsByRef.set(ref, {
    type: "library",
    "bom-ref": ref,
    name,
    version,
    purl: ref,
    scope: metadata.dev ? "optional" : "required",
    licenses: metadata.license ? [{ license: { id: String(metadata.license) } }] : undefined
  });
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: generatedAt,
    component: { type: "application", name: "stockpilot-ai", version: lock.version ?? "0.0.0" },
    properties: [
      { name: "stockpilot:evidence-status", value: "generated-not-attested" },
      { name: "stockpilot:contains-production-data", value: "false" }
    ]
  },
  components: [...componentsByRef.values()].sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"]))
};
writeFileSync(`${outputDir}/sbom.cdx.json`, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");

const evidencePaths = [
  "package-lock.json",
  ".github/workflows/ci.yml",
  ".github/workflows/database-tests.yml",
  "supabase/tests/database/rls_and_integrity.test.sql",
  "supabase/tests/database/institutional_controls.test.sql",
  "supabase/migrations/20260630132652_stockpilot_initial_schema.sql",
  "supabase/migrations/20260710221030_add_institutional_governance_controls.sql",
  "supabase/migrations/20260710221046_harden_institutional_governance_indexes_and_policies.sql",
  "docs/institutional-readiness/security-control-matrix.md",
  "docs/institutional-readiness/local-database-validation.md",
  "docs/institutional-readiness/final-readiness-report.md",
  "artifacts/evidence/model-validation.json",
  "artifacts/evidence/sbom.cdx.json"
];
const evidence = evidencePaths.flatMap((path) => {
  const absolute = `${root}/${path}`;
  if (!existsSync(absolute)) return [];
  const content = readFileSync(absolute);
  return [{ path, sha256: sha256(content), bytes: content.byteLength }];
});
const manifest = {
  schemaVersion: "stockpilot-evidence/1.0.0",
  generatedAt,
  status: "generated_not_attested",
  caveat: "Automatisch erzeugte Nachweise sind keine Zertifizierung und ersetzen keine unabhängige Prüfung.",
  containsProductionData: false,
  evidence
};
writeFileSync(`${outputDir}/evidence-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ components: sbom.components.length, evidence: evidence.length, outputDir }, null, 2));

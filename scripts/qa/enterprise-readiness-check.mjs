#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const localOnly = args.includes("--local-only");
const baseUrl = args.find((arg) => !arg.startsWith("--")) || process.env.STOCKPILOT_ENTERPRISE_BASE_URL || "";
const report = [];
const sensitiveEnvNames = [
  "AI_GATEWAY_API_KEY",
  "ALPHA_VANTAGE_API_KEY",
  "CRON_SECRET",
  "DATABENTO_API_KEY",
  "EODHD_API_KEY",
  "FINNHUB_API_KEY",
  "FMP_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "KV_REST_API_TOKEN",
  "LEMONSQUEEZY_API_KEY",
  "MARKETAUX_API_KEY",
  "MASSIVE_API_KEY",
  "NEWS_API_KEY",
  "NEWSAPI_API_KEY",
  "OPENAI_API_KEY",
  "POLYGON_API_KEY",
  "STOCKPILOT_ADMIN_SECRET",
  "STOCKPILOT_CRON_SECRET",
  "STOCKPILOT_PROVIDER_PING_SECRET",
  "STRIPE_SECRET_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TWELVE_DATA_API_KEY",
  "TWELVEDATA_API_KEY",
  "UPSTASH_REDIS_REST_TOKEN"
];

function add(name, status, severity, detail) {
  report.push({ name, status, severity, detail });
}

function pass(name, detail = "ok") {
  add(name, "pass", "info", detail);
}

function warn(name, detail) {
  add(name, "warn", "warning", detail);
}

function fail(name, detail, severity = "critical") {
  add(name, "fail", severity, detail);
}

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  return readFileSync(repoPath(relativePath), "utf8");
}

function has(relativePath) {
  return existsSync(repoPath(relativePath));
}

function includesAll(content, needles) {
  return needles.every((needle) => content.includes(needle));
}

function checkFile(relativePath, name) {
  if (has(relativePath)) {
    pass(name, relativePath);
    return true;
  }

  fail(name, `${relativePath} fehlt`);
  return false;
}

function listFiles(dir, result = []) {
  if (!existsSync(dir)) return result;

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const relative = path.relative(repoRoot, fullPath);

    if (
      entry === ".git" ||
      entry === ".next" ||
      entry === ".vercel" ||
      entry === "node_modules" ||
      entry === "coverage" ||
      entry === "playwright-report" ||
      entry === "test-results" ||
      entry === "docs/audits"
    ) {
      continue;
    }

    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      listFiles(fullPath, result);
      continue;
    }

    if (stats.size > 750_000) continue;

    const extension = path.extname(entry).toLowerCase();
    const allowed =
      [".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".sql", ".css"].includes(extension) ||
      entry === ".env.example";

    if (allowed && entry !== "package-lock.json") result.push(relative);
  }

  return result;
}

function checkPackage() {
  const pkg = JSON.parse(read("package.json"));

  if (pkg.name === "stockpilot-ai") pass("repo identity", "package name is stockpilot-ai");
  else fail("repo identity", `unexpected package name: ${pkg.name ?? "missing"}`);

  const requiredScripts = [
    "typecheck",
    "lint",
    "test",
    "test:coverage",
    "build",
    "test:e2e",
    "test:load",
    "test:stress",
    "test:chaos",
    "dr:check",
    "enterprise:check",
    "qa:grammar",
    "audit:safe",
    "audit:moderate",
  ];
  const missingScripts = requiredScripts.filter((script) => !pkg.scripts?.[script]);

  if (missingScripts.length === 0) pass("qa script matrix", "all enterprise QA scripts are present");
  else fail("qa script matrix", `missing scripts: ${missingScripts.join(", ")}`);

  const dependencyRanges = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter(([, version]) => typeof version === "string" && /^[~^*]|latest$/i.test(version))
    .map(([name, version]) => `${name}@${version}`);

  if (dependencyRanges.length === 0) pass("dependency pinning", "package versions are pinned");
  else fail("dependency pinning", `unpinned dependency ranges: ${dependencyRanges.join(", ")}`, "high");

  if (pkg.packageManager?.startsWith("npm@")) pass("package manager pin", pkg.packageManager);
  else fail("package manager pin", "packageManager should pin npm version");

  if (has("package-lock.json")) pass("lockfile", "package-lock.json present");
  else fail("lockfile", "package-lock.json missing");
}

function checkSecurityHeaders() {
  const nextConfig = read("next.config.ts");
  const requiredHeaders = [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Permissions-Policy",
    "Referrer-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
  ];

  if (includesAll(nextConfig, requiredHeaders)) pass("security headers", "CSP, HSTS, frame, MIME and policy headers configured");
  else fail("security headers", "one or more enterprise security headers are missing");

  if (/default-src\s+\*/i.test(nextConfig) || /connect-src\s+\*/i.test(nextConfig)) {
    fail("content security policy scope", "CSP contains wildcard source");
  } else {
    pass("content security policy scope", "no wildcard default/connect source detected");
  }

  const apiGuard = read("src/lib/api-guard.ts");
  const apiControls = ["RATE_LIMIT_READ_MAX", "RATE_LIMIT_MUTATION_MAX", "MAX_JSON_BODY_BYTES", "requireSameOrigin", "parseJsonBody", "secureJsonHeaders"];

  if (includesAll(apiGuard, apiControls)) pass("api perimeter controls", "rate limit, body cap, same-origin and secure JSON headers present");
  else fail("api perimeter controls", "API guard is missing one or more perimeter controls");

  const observability = read("src/lib/observability.ts");
  if (observability.includes("[REDACTED]") && observability.includes("SECRET_KEY_PATTERN")) {
    pass("log redaction", "structured logs redact secret-looking fields");
  } else {
    fail("log redaction", "observability logs do not visibly redact secrets");
  }
}

function checkSecrets() {
  const sensitiveEnvNames = [
    "AI_GATEWAY_API_KEY",
    "ALPHA_VANTAGE_API_KEY",
    "CRON_SECRET",
    "DATABENTO_API_KEY",
    "EODHD_API_KEY",
    "FINNHUB_API_KEY",
    "FMP_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "KV_REST_API_TOKEN",
    "LEMONSQUEEZY_API_KEY",
    "MARKETAUX_API_KEY",
    "MASSIVE_API_KEY",
    "NEWS_API_KEY",
    "NEWSAPI_API_KEY",
    "OPENAI_API_KEY",
    "POLYGON_API_KEY",
    "STOCKPILOT_ADMIN_SECRET",
    "STOCKPILOT_CRON_SECRET",
    "STOCKPILOT_PROVIDER_PING_SECRET",
    "STRIPE_SECRET_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TWELVE_DATA_API_KEY",
    "TWELVEDATA_API_KEY",
    "UPSTASH_REDIS_REST_TOKEN"
  ];
  const secretPatterns = [
    /sb_secret_[A-Za-z0-9._-]{10,}/,
    new RegExp(
      `\\b(?:${sensitiveEnvNames.join("|")})[ \\t]*[:=][ \\t]*["']?(?!<|your-|change-me|REDACTED|example|mock|fake|test|invalid|demo|placeholder|local)[A-Za-z0-9._-]{12,}`,
      "i"
    ),
    /authorization[ \t]*[:=][ \t]*["']?bearer[ \t]+[A-Za-z0-9._-]{20,}/i,
    /service_role_[A-Za-z0-9._-]{10,}/i,
  ];
  const matches = [];

  for (const relativePath of listFiles(repoRoot)) {
    if (/\.env(?!\.example$)/.test(relativePath)) continue;
    if (relativePath.includes(".test.") || relativePath.includes(".coverage.")) continue;
    const content = read(relativePath);

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        matches.push(relativePath);
        break;
      }
    }
  }

  if (matches.length === 0) pass("secret exposure scan", "no committed secret-looking values found");
  else fail("secret exposure scan", `possible secret values in: ${matches.join(", ")}`);

  const envExample = read(".env.example");
  const requiredEnvNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FMP_API_KEY",
    "FINNHUB_API_KEY",
    "ALPHA_VANTAGE_API_KEY",
    "MARKETAUX_API_KEY",
    "NEWSAPI_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "CAPACITOR_SERVER_URL",
    "STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED",
    "STOCKPILOT_ENTERPRISE_PROVIDER_LICENSE_REVIEWED",
    "STOCKPILOT_ENTERPRISE_SUPABASE_RLS_VERIFIED",
    "STOCKPILOT_ENTERPRISE_SUPABASE_PITR_ENABLED",
    "STOCKPILOT_ENTERPRISE_MONITORING_ENABLED",
    "STOCKPILOT_ENTERPRISE_SLA_DOCUMENTED",
    "STOCKPILOT_ENTERPRISE_INCIDENT_OWNER",
    "STOCKPILOT_ENTERPRISE_SUPPORT_CONTACT",
  ];
  const missingEnvNames = requiredEnvNames.filter((name) => !envExample.includes(name));

  if (missingEnvNames.length === 0) pass("environment contract", "required provider/auth/cache env names documented");
  else fail("environment contract", `missing env docs: ${missingEnvNames.join(", ")}`, "high");

  if (/NEXT_PUBLIC_(?:.*SECRET|.*SERVICE|.*TOKEN|.*PRIVATE)/i.test(envExample)) {
    fail("public env boundary", "server-only secret appears to be exposed via NEXT_PUBLIC");
  } else {
    pass("public env boundary", "no NEXT_PUBLIC server-secret names detected");
  }
}

function checkSupabase() {
  const schema = read("supabase/schema.sql");
  const migrations = has("supabase/migrations")
    ? readdirSync(repoPath("supabase/migrations"))
        .filter((entry) => entry.endsWith(".sql"))
        .map((entry) => read(path.join("supabase/migrations", entry)))
        .join("\n")
    : "";
  const sql = `${schema}\n${migrations}`.toLowerCase();
  const tables = [
    "profiles",
    "watchlists",
    "alert_rules",
    "portfolio_positions",
    "analysis_snapshots",
    "portfolio_transactions",
    "alert_events",
    "portfolio_snapshots",
    "data_provider_status",
  ];
  const missingRls = tables.filter((table) => !sql.includes(`alter table public.${table} enable row level security`));

  if (missingRls.length === 0) pass("supabase rls coverage", "RLS enabled for user and provider tables");
  else fail("supabase rls coverage", `RLS missing for: ${missingRls.join(", ")}`);

  if (sql.includes("create policy") && sql.includes("to authenticated")) {
    pass("supabase policy model", "authenticated policies are explicit");
  } else {
    fail("supabase policy model", "missing explicit authenticated policies");
  }

  if (sql.includes("auth.role()")) fail("supabase auth role usage", "auth.role() is deprecated and unsafe for anonymous auth edge cases");
  else pass("supabase auth role usage", "auth.role() not used");

  if (sql.includes("security definer")) fail("supabase privileged functions", "SECURITY DEFINER detected; review RLS bypass risk", "high");
  else pass("supabase privileged functions", "no SECURITY DEFINER detected");

  if (sql.includes("revoke execute on function public.set_updated_at() from public")) {
    pass("supabase function execute grant", "trigger helper execute grant is revoked from public");
  } else {
    warn("supabase function execute grant", "set_updated_at execute revoke not found");
  }
}

function checkAvailabilityAndOps() {
  const requiredFiles = [
    ["public/sw.js", "service worker"],
    ["src/app/manifest.ts", "pwa manifest source"],
    ["src/app/offline/page.tsx", "offline page"],
    ["src/app/api/health/route.ts", "health endpoint"],
    ["src/app/api/enterprise/status/route.ts", "enterprise status endpoint"],
    ["src/lib/enterprise-status.ts", "enterprise status model"],
    ["docs/disaster-recovery.md", "disaster recovery runbook"],
    ["docs/enterprise-readiness.md", "enterprise readiness runbook"],
    ["docs/provider-licensing.md", "provider licensing runbook"],
    ["docs/monitoring-alerting.md", "monitoring runbook"],
    ["docs/supabase-backup-pitr.md", "supabase backup runbook"],
    ["scripts/qa/disaster-recovery-check.mjs", "disaster recovery check"],
    [".github/workflows/disaster-recovery.yml", "disaster recovery workflow"],
    [".github/workflows/enterprise-readiness.yml", "enterprise readiness workflow"],
    [".github/workflows/live-monitoring.yml", "live monitoring workflow"],
  ];

  for (const [relativePath, name] of requiredFiles) checkFile(relativePath, name);

  const cache = read("src/lib/server-cache.ts");
  if (cache.includes("upstash_rest") && cache.includes("memory") && cache.includes("sharedConfigured")) {
    pass("cache degradation model", "shared cache is supported with memory fallback");
  } else {
    fail("cache degradation model", "shared cache fallback is incomplete");
  }

  const sw = read("public/sw.js");
  if (sw.includes("stockpilot-static-v") && sw.includes("stockpilot-data-v") && sw.includes("/offline")) {
    pass("offline recovery assets", "static/data cache versions and offline route are present");
  } else {
    fail("offline recovery assets", "service worker does not clearly cache recovery assets");
  }
}

function checkCiCd() {
  const ci = read(".github/workflows/ci.yml");
  const manualDeploy = read(".github/workflows/vercel-manual.yml");
  const dr = read(".github/workflows/disaster-recovery.yml");
  const enterpriseWorkflow = read(".github/workflows/enterprise-readiness.yml");

  const ciGates = [
    "npm run typecheck",
    "npm run lint",
    "npm run test:coverage",
    "npm run build",
    "npm run qa:grammar",
    "npm run audit:moderate",
    "npm run enterprise:check -- --local-only",
  ];
  const missingCiGates = ciGates.filter((gate) => !ci.includes(gate));

  if (missingCiGates.length === 0) pass("ci quality gates", "typecheck, lint, coverage, build, grammar, audit and enterprise gates present");
  else fail("ci quality gates", `missing CI gates: ${missingCiGates.join(", ")}`, "high");

  if (ci.includes("permissions:\n  contents: read") && ci.includes("timeout-minutes")) {
    pass("ci least privilege and timeouts", "CI permissions and timeouts are constrained");
  } else {
    fail("ci least privilege and timeouts", "CI permissions/timeouts need tightening", "high");
  }

  if (manualDeploy.includes("STOCKPILOT_VERCEL_PROJECT_ID") && manualDeploy.includes("vercel deploy --prebuilt")) {
    pass("manual deployment isolation", "StockPilot-specific Vercel secrets and prebuilt deploy are configured");
  } else {
    fail("manual deployment isolation", "manual Vercel deployment is not isolated enough", "high");
  }

  if (dr.includes("npm run dr:check")) pass("dr drill automation", "manual DR drill workflow is configured");
  else fail("dr drill automation", "DR workflow does not run the DR check");

  if (enterpriseWorkflow.includes("npm run enterprise:check")) pass("enterprise drill automation", "manual enterprise readiness workflow is configured");
  else fail("enterprise drill automation", "enterprise workflow does not run the enterprise check");
}

async function fetchJson(url) {
  const controller = new globalThis.AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let json = null;

    try {
      json = JSON.parse(text);
    } catch {
      // Some enterprise endpoints are HTML or plain text.
    }

    return { response, text, json };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function checkLiveTarget() {
  if (localOnly || !baseUrl) {
    warn("live readiness target", "skipped; pass a base URL to check deployed headers and health");
    return;
  }

  const target = baseUrl.replace(/\/$/, "");

  try {
    const home = await fetchJson(target);
    const requiredHeaders = ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy"];
    const missingHeaders = requiredHeaders.filter((header) => !home.response.headers.get(header));

    if (home.response.ok && missingHeaders.length === 0) pass("live security headers", "deployment sends enterprise security headers");
    else fail("live security headers", `status=${home.response.status}, missing=${missingHeaders.join(", ") || "none"}`, "high");

    const health = await fetchJson(`${target}/api/health`);
    if (health.response.ok && health.json?.status === "ok") {
      const cacheMode = health.json.cache?.mode ?? "unknown";
      const shared = Boolean(health.json.cache?.sharedConfigured);
      pass("live health endpoint", `cache=${cacheMode}, shared=${shared}`);
      if (!shared) warn("live shared cache", "Upstash/Redis is not configured; enterprise multi-instance rate-limit/cache recovery is weaker");
    } else {
      fail("live health endpoint", `status=${health.response.status}`);
    }

    const enterprise = await fetchJson(`${target}/api/enterprise/status`);
    if (enterprise.response.ok && enterprise.json?.app === "stockpilot-ai" && Number.isFinite(enterprise.json?.score)) {
      pass("live enterprise status", `readiness=${enterprise.json.readiness}, score=${enterprise.json.score}`);
      if (enterprise.json.readiness !== "world_class_ready") {
        warn("live enterprise external controls", "external provider licensing, backup, monitoring, SLA or shared cache controls are not all marked ready");
      }
    } else if (enterprise.response.status === 404) {
      warn("live enterprise status", "endpoint is not deployed yet; push and deploy the latest commit");
    } else {
      fail("live enterprise status", `status=${enterprise.response.status}`);
    }

    const sensitiveLivePattern = new RegExp(
      `(sb_secret|service_role|authorization|bearer\\s+[a-z0-9._-]{12,}|${sensitiveEnvNames.join("|")})`,
      "i"
    );
    if (sensitiveLivePattern.test(home.text) || sensitiveLivePattern.test(JSON.stringify(health.json ?? {}))) {
      fail("live secret exposure", "secret-looking value appears in public response");
    } else {
      pass("live secret exposure", "no secret-looking values found in home/health responses");
    }
  } catch (error) {
    fail("live readiness target", error instanceof Error ? error.message : "live check failed", "high");
  }
}

checkPackage();
checkSecurityHeaders();
checkSecrets();
checkSupabase();
checkAvailabilityAndOps();
checkCiCd();
await checkLiveTarget();

const failures = report.filter((item) => item.status === "fail");
const warnings = report.filter((item) => item.status === "warn");
const score = Math.max(0, Math.round(((report.length - failures.length - warnings.length * 0.25) / report.length) * 100));

console.table(report);
console.log(`Enterprise readiness score: ${score}/100`);

if (failures.length > 0) {
  console.error(`Enterprise readiness failed with ${failures.length} failure(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Enterprise readiness passed with ${warnings.length} warning(s).`);

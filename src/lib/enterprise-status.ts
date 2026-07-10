import { getPublicRuntimeDiagnostics } from "@/lib/observability";
import { getServerCacheAdapter } from "@/lib/server-cache";

export type EnterpriseControlState = "ready" | "warning" | "missing";

export type EnterpriseControl = {
  id: string;
  title: string;
  state: EnterpriseControlState;
  category: "security" | "operations" | "data" | "recovery" | "compliance";
  detail: string;
  owner: string;
  runbook?: string;
};

export type EnterpriseStatus = {
  app: "stockpilot-ai";
  generatedAt: string;
  environment: string;
  deployment: string;
  readiness: "world_class_ready" | "production_ready_with_warnings" | "not_enterprise_ready";
  score: number;
  summary: {
    ready: number;
    warning: number;
    missing: number;
  };
  controls: EnterpriseControl[];
  requiredExternalActions: string[];
};

function enabled(name: string) {
  return /^(1|true|yes|enabled|ready)$/i.test(process.env[name] ?? "");
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function control(input: EnterpriseControl): EnterpriseControl {
  return input;
}

export function getEnterpriseStatus(): EnterpriseStatus {
  const cache = getServerCacheAdapter();
  const diagnostics = getPublicRuntimeDiagnostics();
  const providerConfigured =
    diagnostics.configured.finnhub ||
    diagnostics.configured.fmp ||
    diagnostics.configured.alphaVantage ||
    diagnostics.configured.newsApi ||
    diagnostics.configured.marketaux;
  const supabaseConfigured = diagnostics.configured.supabase;
  const supabaseRlsVerified = enabled("STOCKPILOT_ENTERPRISE_SUPABASE_RLS_VERIFIED");

  const controls: EnterpriseControl[] = [
    control({
      id: "security-headers",
      title: "Security headers and CSP",
      state: "ready",
      category: "security",
      detail: "CSP, HSTS, frame protection, MIME protection and restrictive permission policies are configured in Next.js.",
      owner: "Engineering",
      runbook: "docs/enterprise-readiness.md",
    }),
    control({
      id: "api-perimeter",
      title: "API perimeter controls",
      state: "ready",
      category: "security",
      detail: "API routes use secure JSON headers, rate limiting, body-size limits and same-origin protection for mutations.",
      owner: "Engineering",
      runbook: "src/lib/api-guard.ts",
    }),
    control({
      id: "secret-boundary",
      title: "Secret boundary",
      state: "ready",
      category: "security",
      detail: "Provider keys and Supabase service credentials are server-only and are not exposed through public env names.",
      owner: "Engineering",
      runbook: "docs/enterprise-readiness.md",
    }),
    control({
      id: "supabase-rls",
      title: "Supabase RLS model",
      state: supabaseRlsVerified ? "ready" : supabaseConfigured ? "warning" : "missing",
      category: "security",
      detail: supabaseRlsVerified
        ? "Supabase RLS has been externally verified for user-data tables and owner-scoped policies."
        : supabaseConfigured
          ? "Supabase is configured, but live RLS/advisor verification has not been marked complete. Do not treat this as enterprise-ready yet."
          : "Supabase is not configured, so user-data RLS cannot be verified in this environment.",
      owner: "Engineering",
      runbook: "supabase/schema.sql",
    }),
    control({
      id: "shared-cache",
      title: "Shared cache and distributed rate limits",
      state: cache.sharedConfigured ? "ready" : "warning",
      category: "operations",
      detail: cache.sharedConfigured
        ? `Shared cache is configured. Runtime mode: ${cache.mode}.`
        : "Shared cache is not active. The app falls back to in-memory cache, which is functional but weaker across multiple serverless instances.",
      owner: "Platform",
      runbook: "docs/enterprise-readiness.md",
    }),
    control({
      id: "provider-keys",
      title: "Market/news provider credentials",
      state: providerConfigured ? "ready" : "warning",
      category: "data",
      detail: providerConfigured
        ? "At least one market/news/fundamentals provider key is configured server-side."
        : "No external provider key is detected. The app must clearly show mock/unavailable data quality in this mode.",
      owner: "Data",
      runbook: "docs/provider-licensing.md",
    }),
    control({
      id: "provider-license-review",
      title: "Provider license review",
      state: enabled("STOCKPILOT_ENTERPRISE_PROVIDER_LICENSE_REVIEWED") ? "ready" : "missing",
      category: "compliance",
      detail: enabled("STOCKPILOT_ENTERPRISE_PROVIDER_LICENSE_REVIEWED")
        ? "Provider licensing review is marked complete."
        : "Provider contracts, realtime claims and redistribution rights must be reviewed before enterprise customers.",
      owner: "Legal/Data",
      runbook: "docs/provider-licensing.md",
    }),
    control({
      id: "data-quality-labels",
      title: "Data quality labels",
      state: "ready",
      category: "data",
      detail: "Market responses include provider, quality, timestamp and degraded/mock state so delayed data is not presented as realtime.",
      owner: "Product/Data",
      runbook: "docs/enterprise-readiness.md",
    }),
    control({
      id: "backup-pitr",
      title: "Supabase backup and PITR confirmation",
      state: enabled("STOCKPILOT_ENTERPRISE_SUPABASE_PITR_ENABLED") ? "ready" : "missing",
      category: "recovery",
      detail: enabled("STOCKPILOT_ENTERPRISE_SUPABASE_PITR_ENABLED")
        ? "Supabase backup/PITR is marked enabled for the selected production plan."
        : "Backup/PITR depends on the Supabase project plan and must be confirmed outside the codebase.",
      owner: "Platform",
      runbook: "docs/supabase-backup-pitr.md",
    }),
    control({
      id: "disaster-recovery",
      title: "Disaster recovery drill",
      state: "ready",
      category: "recovery",
      detail: "DR runbook, script and GitHub workflow are available for health, PWA, degraded quote and secret-exposure checks.",
      owner: "Platform",
      runbook: "docs/disaster-recovery.md",
    }),
    control({
      id: "baseline-live-monitoring",
      title: "Baseline live monitoring",
      state: enabled("STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED") ? "ready" : "missing",
      category: "operations",
      detail: enabled("STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED")
        ? "Scheduled live checks are marked active for health, DR and enterprise readiness."
        : "Enable the scheduled GitHub Actions live-monitoring workflow and set the baseline monitoring gate after confirming it runs.",
      owner: "Platform",
      runbook: "docs/monitoring-alerting.md",
    }),
    control({
      id: "monitoring-alerting",
      title: "Enterprise APM and alerting",
      state: enabled("STOCKPILOT_ENTERPRISE_MONITORING_ENABLED")
        ? "ready"
        : enabled("STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED")
          ? "warning"
          : "missing",
      category: "operations",
      detail: enabled("STOCKPILOT_ENTERPRISE_MONITORING_ENABLED")
        ? "Full operational monitoring is marked enabled."
        : enabled("STOCKPILOT_ENTERPRISE_BASELINE_MONITORING_ENABLED")
          ? "Baseline scheduled monitoring is active, but full APM/alert routing for latency, provider failures and auth failures is still recommended."
          : "5xx spikes, quote latency, provider errors, auth failures and rate-limit spikes need active alerting.",
      owner: "Platform",
      runbook: "docs/monitoring-alerting.md",
    }),
    control({
      id: "incident-ownership",
      title: "Incident ownership",
      state: configured("STOCKPILOT_ENTERPRISE_INCIDENT_OWNER") && configured("STOCKPILOT_ENTERPRISE_SUPPORT_CONTACT") ? "ready" : "missing",
      category: "operations",
      detail:
        configured("STOCKPILOT_ENTERPRISE_INCIDENT_OWNER") && configured("STOCKPILOT_ENTERPRISE_SUPPORT_CONTACT")
          ? "Incident owner and support contact are configured."
          : "Set an incident owner and support contact before enterprise launch.",
      owner: "Operations",
      runbook: "docs/monitoring-alerting.md",
    }),
    control({
      id: "sla-documentation",
      title: "SLA and customer communication",
      state: enabled("STOCKPILOT_ENTERPRISE_SLA_DOCUMENTED") ? "ready" : "missing",
      category: "operations",
      detail: enabled("STOCKPILOT_ENTERPRISE_SLA_DOCUMENTED")
        ? "SLA/customer communication process is marked documented."
        : "Define support response times, outage messaging and data-delay communication before enterprise contracts.",
      owner: "Operations/Legal",
      runbook: "docs/enterprise-readiness.md",
    }),
  ];

  const summary = controls.reduce(
    (accumulator, item) => {
      accumulator[item.state] += 1;
      return accumulator;
    },
    { ready: 0, warning: 0, missing: 0 },
  );
  const score = Math.max(0, Math.round(((summary.ready + summary.warning * 0.5) / controls.length) * 100));
  const readiness =
    summary.missing > 0
      ? "not_enterprise_ready"
      : summary.warning > 0
        ? "production_ready_with_warnings"
        : "world_class_ready";
  const requiredExternalActions = controls
    .filter((item) => item.state !== "ready")
    .map((item) => `${item.title}: ${item.detail}`);

  return {
    app: "stockpilot-ai",
    generatedAt: new Date().toISOString(),
    environment: diagnostics.environment,
    deployment: diagnostics.deployment,
    readiness,
    score,
    summary,
    controls,
    requiredExternalActions,
  };
}

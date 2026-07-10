import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

type SecretRole = "admin" | "provider_ping" | "intelligence_ingest" | "analysis_reproduction";

const MIN_SECRET_LENGTH = 24;

function normalizedSecret(value: string | undefined) {
  const secret = value?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
}

function secretsEqual(candidate: string | null, expected: string) {
  if (!candidate) return false;
  const candidateDigest = createHash("sha256").update(candidate, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function matchesSecret(request: Request, secret: string, headerName: string) {
  return secretsEqual(getBearerToken(request), secret) || secretsEqual(request.headers.get(headerName)?.trim() ?? null, secret);
}

function adminSecret() {
  return normalizedSecret(process.env.STOCKPILOT_ADMIN_SECRET);
}

function providerPingSecret() {
  return normalizedSecret(process.env.STOCKPILOT_PROVIDER_PING_SECRET);
}

function cronSecrets() {
  return [
    normalizedSecret(process.env.CRON_SECRET),
    normalizedSecret(process.env.STOCKPILOT_CRON_SECRET)
  ].filter((secret): secret is string => Boolean(secret));
}

function intelligenceIngestSecret() {
  return normalizedSecret(process.env.STOCKPILOT_INTELLIGENCE_INGEST_SECRET);
}

export function hasPrivilegedAccess(request: Request, role: SecretRole) {
  const admin = adminSecret();

  if (admin && matchesSecret(request, admin, "x-stockpilot-admin-secret")) {
    return true;
  }

  if (role === "intelligence_ingest") {
    const intelligenceSecret = intelligenceIngestSecret();
    if (intelligenceSecret && matchesSecret(request, intelligenceSecret, "x-stockpilot-intelligence-secret")) {
      return true;
    }

    return cronSecrets().some((cron) => matchesSecret(request, cron, "x-stockpilot-intelligence-secret"));
  }

  if (role !== "provider_ping") return false;

  const pingSecret = providerPingSecret();
  if (pingSecret && matchesSecret(request, pingSecret, "x-stockpilot-provider-ping-secret")) {
    return true;
  }

  return cronSecrets().some((cron) => matchesSecret(request, cron, "x-stockpilot-provider-ping-secret"));
}

export function hasStrongAdminSecret() {
  return Boolean(adminSecret());
}

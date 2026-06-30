import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const defaultBaseUrl = "http://localhost:3010";
const baseUrl = (process.argv[2] || process.env.STOCKPILOT_DR_BASE_URL || defaultBaseUrl).replace(/\/$/, "");
const serverPort = new URL(baseUrl).port || "3010";
const localTarget = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(baseUrl);
const secretPattern = /(sb_secret|service_role|api[_-]?key|bearer\s+[a-z0-9._-]{12,}|secret_[a-z0-9]|FMP_API_KEY|ALPHA_VANTAGE_API_KEY|MARKETAUX_API_KEY)/i;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (!localTarget || await canReachServer()) return null;

  const hasProductionBuild = existsSync(".next/BUILD_ID");
  const child = spawn("npm", ["run", hasProductionBuild ? "start" : "dev", "--", "-p", serverPort], {
    cwd: process.cwd(),
    stdio: "ignore",
    shell: false
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await wait(500);
    if (await canReachServer()) return child;
  }

  child.kill();
  throw new Error(`Server did not become reachable at ${baseUrl}`);
}

async function request(path) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    // Text/HTML response.
  }

  return {
    path,
    status: response.status,
    ok: response.ok,
    ms: Math.round(performance.now() - started),
    headers: Object.fromEntries(response.headers.entries()),
    text,
    json
  };
}

function result(name, status, severity, detail) {
  return { name, status, severity, detail };
}

function pass(name, detail = "ok") {
  return result(name, "pass", "info", detail);
}

function warn(name, detail) {
  return result(name, "warn", "warning", detail);
}

function fail(name, detail) {
  return result(name, "fail", "critical", detail);
}

const serverProcess = await ensureServer();
const report = [];

try {
  const health = await request("/api/health");
  if (health.status === 200 && health.json?.status === "ok") {
    report.push(pass("health endpoint", `cache=${health.json.cache?.mode ?? "unknown"}, env=${health.json.runtime?.environment ?? "unknown"}`));
    if (!health.json.cache?.sharedConfigured) {
      report.push(warn("shared cache", "Upstash/Redis is not configured; rollback works, but multi-instance rate-limit/cache recovery is weaker."));
    }
  } else {
    report.push(fail("health endpoint", `expected 200 ok, got ${health.status}`));
  }

  const serviceWorker = await request("/sw.js");
  if (serviceWorker.status === 200 && serviceWorker.text.includes("stockpilot-static-v") && serviceWorker.text.includes("stockpilot-data-v")) {
    report.push(pass("service worker recovery cache", "static and data cache versions present"));
  } else {
    report.push(fail("service worker recovery cache", "missing static/data cache version markers"));
  }

  const offlinePage = await request("/offline");
  if (offlinePage.status === 200 && offlinePage.text.includes("Offline-Modus")) {
    report.push(pass("offline fallback page", "offline route renders"));
  } else {
    report.push(fail("offline fallback page", `expected offline page, got ${offlinePage.status}`));
  }

  const manifest = await request("/manifest.webmanifest");
  if (manifest.status === 200 && manifest.json?.display === "standalone" && manifest.json?.start_url === "/") {
    report.push(pass("pwa manifest", "standalone app manifest is valid"));
  } else {
    report.push(fail("pwa manifest", "manifest missing standalone display or start_url"));
  }

  const quotes = await request("/api/market/quotes?symbols=AAPL,BTC-USD");
  if (quotes.status < 500 && Array.isArray(quotes.json?.quotes) && quotes.json.quotes.length > 0) {
    report.push(pass("market quotes degraded operation", `status=${quotes.status}, provider=${quotes.json.provider ?? "unknown"}`));
  } else {
    report.push(fail("market quotes degraded operation", `expected non-5xx quotes payload, got ${quotes.status}`));
  }

  const invalidQuotes = await request("/api/market/quotes?symbols=%25%25%25");
  report.push(invalidQuotes.status === 400 ? pass("invalid input containment", "bad symbols return 400") : fail("invalid input containment", `expected 400, got ${invalidQuotes.status}`));

  const tooManyQuotes = await request(`/api/market/quotes?symbols=${Array.from({ length: 41 }, (_, index) => `T${index}`).join(",")}`);
  report.push(tooManyQuotes.status === 400 ? pass("request size containment", "too many symbols return 400") : fail("request size containment", `expected 400, got ${tooManyQuotes.status}`));

  const unknownFundamentals = await request("/api/fundamentals/DOESNOTEXIST");
  report.push(unknownFundamentals.status === 404 ? pass("unknown fundamentals containment", "unknown symbol returns 404") : fail("unknown fundamentals containment", `expected 404, got ${unknownFundamentals.status}`));

  const allBodies = [health, serviceWorker, offlinePage, manifest, quotes, invalidQuotes, tooManyQuotes, unknownFundamentals]
    .map((entry) => entry.text)
    .join("\n");
  report.push(secretPattern.test(allBodies) ? fail("secret exposure scan", "secret-looking value found in public recovery checks") : pass("secret exposure scan", "no secret-looking values found"));
} finally {
  serverProcess?.kill();
}

console.table(report);

const failed = report.some((entry) => entry.status === "fail");
const warnings = report.filter((entry) => entry.status === "warn").length;
console.log(`Disaster recovery check target: ${baseUrl}`);
console.log(`Disaster recovery result: ${failed ? "failed" : "passed"} with ${warnings} warning(s).`);

if (failed) process.exit(1);

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const baseUrl = process.env.STOCKPILOT_CAPACITY_BASE_URL ?? "http://127.0.0.1:3030";
const sessions = Number(process.env.STOCKPILOT_CAPACITY_SESSIONS) || 10_000;
const concurrency = Number(process.env.STOCKPILOT_CAPACITY_CONCURRENCY) || 128;
const timeoutMs = Number(process.env.STOCKPILOT_CAPACITY_TIMEOUT_MS) || 10_000;
const p95BudgetMs = Number(process.env.STOCKPILOT_CAPACITY_P95_BUDGET_MS) || 5_000;
const paths = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/manifest.webmanifest",
  "/api/health",
  "/api/health",
  "/api/health",
  "/api/health",
  "/api/health",
  "/api/health",
  "/api/institutional/readiness",
  "/api/institutional/readiness",
  "/api/institutional/readiness",
  "/api/institutional/readiness",
  "/api/institutional/readiness",
  "/api/institutional/readiness"
];
const url = new URL(baseUrl);
const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

if (!local) throw new Error("10,000-session capacity test is local-only and may never target production or third parties.");
if (sessions < 10_000) throw new Error("Capacity test must simulate at least 10,000 sessions.");
if (!existsSync(".next/BUILD_ID")) throw new Error("Production build missing. Run npm run build first.");

const agentOptions = { keepAlive: true, keepAliveMsecs: 1000, maxSockets: concurrency, maxFreeSockets: concurrency, timeout: timeoutMs };
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percent) - 1)];
}

function requestOnce(path, sessionId) {
  const target = new URL(path, baseUrl);
  const transport = target.protocol === "https:" ? https : http;
  const agent = target.protocol === "https:" ? httpsAgent : httpAgent;
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method: "GET",
      agent,
      timeout: timeoutMs,
      headers: {
        "User-Agent": "StockPilot-QA-Capacity/1.0",
        "X-Forwarded-For": `10.249.${Math.floor(sessionId / 255)}.${sessionId % 255}`,
        "Cookie": `stockpilot-qa-session=session-${sessionId}`
      }
    }, (response) => {
      let bytes = 0;
      response.on("data", (chunk) => { bytes += chunk.length; });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, bytes, duration: performance.now() - started }));
    });
    request.on("timeout", () => request.destroy(new Error("capacity_request_timeout")));
    request.on("error", reject);
    request.end();
  });
}

async function requestWithRetry(path, sessionId) {
  let retries = 0;
  const started = performance.now();
  while (true) {
    try {
      const result = await requestOnce(path, sessionId);
      return { ...result, retries, duration: performance.now() - started };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if ((code !== "ECONNRESET" && code !== "EPIPE") || retries >= 2) throw error;
      retries += 1;
      await wait(25 * retries);
    }
  }
}

async function canReach() {
  try {
    const response = await requestOnce("/api/health", 1);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await canReach()) return null;
  const child = spawn("npm", ["run", "start", "--", "-p", url.port || "3030"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      STOCKPILOT_MARKET_PROVIDER: "mock",
      STOCKPILOT_NEWS_PROVIDER: "mock",
      STOCKPILOT_FUNDAMENTALS_PROVIDER: "mock",
      STOCKPILOT_AI_PROVIDER: "mock"
    },
    stdio: "ignore",
    shell: false
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await wait(250);
    if (await canReach()) return child;
  }
  child.kill();
  throw new Error(`Capacity server did not become reachable at ${baseUrl}`);
}

const durations = [];
const statuses = {};
let bytes = 0;
let retries = 0;
let failures = 0;
const errors = {};
let nextSession = 1;
const started = performance.now();
const server = await startServer();

try {
  for (const warmup of [32, 64, concurrency]) {
    await Promise.all(Array.from({ length: warmup }, (_, index) => requestWithRetry("/api/health", 20_000 + index)));
    await wait(50);
  }

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const sessionId = nextSession;
      nextSession += 1;
      if (sessionId > sessions) return;
      try {
        const result = await requestWithRetry(paths[(sessionId - 1) % paths.length], sessionId);
        durations.push(result.duration);
        statuses[result.status] = (statuses[result.status] ?? 0) + 1;
        bytes += result.bytes;
        retries += result.retries;
        if (result.status < 200 || result.status >= 400 || result.duration > timeoutMs) failures += 1;
      } catch (error) {
        failures += 1;
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
        errors[code] = (errors[code] ?? 0) + 1;
      }
    }
  });
  await Promise.all(workers);
} finally {
  server?.kill();
  httpAgent.destroy();
  httpsAgent.destroy();
}

const runtimeMs = performance.now() - started;
const report = {
  sessions,
  concurrency,
  requests: durations.length,
  failures,
  retries,
  p50: Math.round(percentile(durations, 0.5)),
  p95: Math.round(percentile(durations, 0.95)),
  p99: Math.round(percentile(durations, 0.99)),
  max: Math.round(Math.max(...durations, 0)),
  requestsPerSecond: Math.round((durations.length / runtimeMs) * 1000),
  transferredMiB: Number((bytes / 1024 / 1024).toFixed(2)),
  statuses,
  errors
};
console.log(JSON.stringify(report, null, 2));
if (failures > 0 || durations.length !== sessions || report.p95 > p95BudgetMs) process.exit(1);

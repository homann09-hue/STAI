import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const baseUrl = process.env.STOCKPILOT_QA_BASE_URL ?? "http://localhost:3010";
const serverPort = new URL(baseUrl).port || "3010";
const activeUsers = Number(process.env.STOCKPILOT_QA_ACTIVE_USERS ?? 2000);
const sessionDurationMs = Number(process.env.STOCKPILOT_QA_SESSION_DURATION_MS ?? 30000);
const requestsPerSession = Number(process.env.STOCKPILOT_QA_REQUESTS_PER_SESSION ?? 1);
const includeExtremeMicroburst = process.env.STOCKPILOT_QA_MICROBURST_2000 === "true";
const burstConcurrencies = includeExtremeMicroburst
  ? [1, 10, 25, 50, 100, 200, 500, 1000, 2000]
  : [1, 10, 25, 50, 100, 200, 500];
const requiredActiveUsers = 2000;
const maxClientSockets = Number(process.env.STOCKPILOT_QA_MAX_CLIENT_SOCKETS ?? 256);
const requestTimeoutMs = Number(process.env.STOCKPILOT_QA_REQUEST_TIMEOUT_MS ?? 15000);
const slowRequestThresholdMs = Number(process.env.STOCKPILOT_QA_SLOW_REQUEST_MS ?? 5000);
const hardRequestThresholdMs = Number(process.env.STOCKPILOT_QA_HARD_REQUEST_MS ?? 15000);
const paths = [
  "/",
  "/assets/NVDA",
  "/assets/AAPL",
  "/assets/BTC-USD",
  "/portfolio",
  "/alerts",
  "/api/market/overview",
  "/api/assets/NVDA",
  "/api/assets/BTC-USD",
  "/api/news?symbol=NVDA",
  "/api/ai/analysis?symbol=NVDA",
  "/api/portfolio",
  "/manifest.webmanifest"
];
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: maxClientSockets });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: maxClientSockets });

let inFlightRequests = 0;
let peakInFlightRequests = 0;

function isLocalBaseUrl() {
  const { hostname } = new URL(baseUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

if (activeUsers < requiredActiveUsers) {
  throw new Error(`Load test must include at least ${requiredActiveUsers} active users.`);
}

if (!Number.isFinite(sessionDurationMs) || sessionDurationMs < 5000) {
  throw new Error("Session duration must be at least 5,000ms.");
}

if (!Number.isInteger(requestsPerSession) || requestsPerSession < 1) {
  throw new Error("Requests per session must be a positive integer.");
}

if (!isLocalBaseUrl() && process.env.STOCKPILOT_QA_ALLOW_REMOTE_2000 !== "true") {
  throw new Error(
    "2,000 active-user load tests are blocked for remote URLs by default. Set STOCKPILOT_QA_ALLOW_REMOTE_2000=true only when you intentionally want to stress a remote deployment."
  );
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachServer() {
  try {
    const response = await requestText(baseUrl);
    return response.status < 500;
  } catch {
    return false;
  }
}

function requestText(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        agent: url.protocol === "https:" ? httpsAgent : httpAgent,
        headers,
        method: "GET",
        timeout: requestTimeoutMs
      },
      (response) => {
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 400),
            bytes
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("request_timeout"));
    });
    request.on("error", reject);
    request.end();
  });
}

async function ensureServer() {
  if (await canReachServer()) return null;

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

async function hit(path, virtualUser) {
  const started = performance.now();
  inFlightRequests += 1;
  peakInFlightRequests = Math.max(peakInFlightRequests, inFlightRequests);

  try {
    const response = await requestText(`${baseUrl}${path}`, {
      "User-Agent": "StockPilot-QA-LoadTest/2.0",
      "X-Forwarded-For": `10.240.${Math.floor(virtualUser / 255)}.${virtualUser % 255}`
    });

    return {
      path,
      status: response.status,
      ok: response.ok,
      duration: performance.now() - started,
      bytes: response.bytes
    };
  } finally {
    inFlightRequests -= 1;
  }
}

function summarizeOutcomes(outcomes) {
  const fulfilled = outcomes
    .filter((outcome) => outcome.status === "fulfilled")
    .map((outcome) => outcome.value);
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
  const httpFailures = fulfilled.filter((result) => !result.ok);
  const slowRequests = fulfilled.filter((result) => result.duration > slowRequestThresholdMs);
  const durations = fulfilled.map((result) => result.duration);

  return {
    requests: outcomes.length,
    rejected: rejected.length,
    failedHttp: httpFailures.length,
    slowRequests: slowRequests.length,
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    max: Math.round(Math.max(...durations, 0)),
    minBytes: fulfilled.length ? Math.min(...fulfilled.map((result) => result.bytes)) : 0,
    statuses: fulfilled.reduce((accumulator, result) => {
      accumulator[result.status] = (accumulator[result.status] ?? 0) + 1;
      return accumulator;
    }, {})
  };
}

async function runBurstLevel(concurrency) {
  peakInFlightRequests = 0;
  const batch = Array.from({ length: concurrency }, (_, index) => hit(paths[index % paths.length], index + 1));
  const outcomes = await Promise.allSettled(batch);

  return {
    mode: "microburst",
    users: concurrency,
    ...summarizeOutcomes(outcomes),
    peakInFlight: peakInFlightRequests
  };
}

function sessionOffsets(virtualUser) {
  const slotDuration = sessionDurationMs / requestsPerSession;
  return Array.from({ length: requestsPerSession }, (_, requestIndex) => {
    const slotStart = requestIndex * slotDuration;
    const usableSlot = Math.max(1, Math.floor(slotDuration * 0.9));
    const deterministicJitter = (virtualUser * 1543 + requestIndex * 787) % usableSlot;
    return Math.floor(slotStart + deterministicJitter);
  });
}

async function runVirtualSession(virtualUser) {
  const sessionStarted = performance.now();
  const outcomes = [];
  const offsets = sessionOffsets(virtualUser);

  for (let requestIndex = 0; requestIndex < offsets.length; requestIndex += 1) {
    const delay = sessionStarted + offsets[requestIndex] - performance.now();
    if (delay > 0) await wait(delay);

    const path = paths[(virtualUser + requestIndex * 5) % paths.length];
    try {
      outcomes.push({ status: "fulfilled", value: await hit(path, virtualUser) });
    } catch (reason) {
      outcomes.push({ status: "rejected", reason });
    }
  }

  const remainingSessionTime = sessionStarted + sessionDurationMs - performance.now();
  if (remainingSessionTime > 0) await wait(remainingSessionTime);
  return outcomes;
}

async function runActiveUserScenario() {
  peakInFlightRequests = 0;
  const scenarioStarted = performance.now();
  const sessions = await Promise.all(
    Array.from({ length: activeUsers }, (_, index) => runVirtualSession(index + 1))
  );
  const outcomes = sessions.flat();
  const elapsedMs = performance.now() - scenarioStarted;

  return {
    mode: "active-sessions",
    users: activeUsers,
    ...summarizeOutcomes(outcomes),
    peakInFlight: peakInFlightRequests,
    requestsPerSecond: Math.round((outcomes.length / elapsedMs) * 1000)
  };
}

function violatesThreshold(report) {
  return (
    report.rejected > 0 ||
    report.failedHttp > 0 ||
    report.p95 > slowRequestThresholdMs ||
    report.max > hardRequestThresholdMs
  );
}

const started = performance.now();
const burstReport = [];
const serverProcess = await ensureServer();

try {
  for (const concurrency of burstConcurrencies) {
    burstReport.push(await runBurstLevel(concurrency));
  }

  const activeUserReport = await runActiveUserScenario();
  console.log("Microburst capacity (instantaneous requests):");
  console.table(burstReport);
  console.log("Active-session capacity (users include realistic think time):");
  console.table([activeUserReport]);
  console.log(`Load test runtime: ${Math.round(performance.now() - started)}ms`);

  if (burstReport.some(violatesThreshold) || violatesThreshold(activeUserReport)) {
    console.error("Load test failed: transport/HTTP error or configured latency threshold exceeded.");
    process.exitCode = 1;
  }
} finally {
  serverProcess?.kill();
  httpAgent.destroy();
  httpsAgent.destroy();
}

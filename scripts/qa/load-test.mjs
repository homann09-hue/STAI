import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const baseUrl = process.env.STOCKPILOT_QA_BASE_URL ?? "http://localhost:3010";
const serverPort = new URL(baseUrl).port || "3010";
const concurrencies = [1, 10, 25, 50, 100, 200, 500, 1000, 2000];
const requiredPeakConcurrency = 2000;
const maxClientSockets = Number(process.env.STOCKPILOT_QA_MAX_CLIENT_SOCKETS ?? 256);
const requestTimeoutMs = Number(process.env.STOCKPILOT_QA_REQUEST_TIMEOUT_MS ?? 15000);
const slowRequestThresholdMs = Number(process.env.STOCKPILOT_QA_SLOW_REQUEST_MS ?? 15000);
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

function isLocalBaseUrl() {
  const { hostname } = new URL(baseUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

if (!concurrencies.includes(requiredPeakConcurrency)) {
  throw new Error(`Load test must include ${requiredPeakConcurrency} active users.`);
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
  const response = await requestText(`${baseUrl}${path}`, {
      "User-Agent": "StockPilot-QA-LoadTest/1.0",
      "X-Forwarded-For": `10.240.${Math.floor(virtualUser / 255)}.${virtualUser % 255}`
  });
  const duration = performance.now() - started;

  return {
    path,
    status: response.status,
    ok: response.ok,
    duration,
    bytes: response.bytes
  };
}

async function runLevel(concurrency) {
  const batch = Array.from({ length: concurrency }, (_, index) => hit(paths[index % paths.length], index + 1));
  const results = await Promise.allSettled(batch);
  const fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const rejected = results.filter((result) => result.status === "rejected");
  const failures = fulfilled.filter((result) => !result.ok || result.duration > slowRequestThresholdMs);
  const durations = fulfilled.map((result) => result.duration);

  return {
    concurrency,
    requests: results.length,
    rejected: rejected.length,
    failedHttpOrSlow: failures.length,
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    max: Math.round(Math.max(...durations, 0)),
    minBytes: Math.min(...fulfilled.map((result) => result.bytes), Number.POSITIVE_INFINITY),
    statuses: fulfilled.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {})
  };
}

const started = performance.now();
const report = [];
const serverProcess = await ensureServer();

try {
  for (const concurrency of concurrencies) {
    report.push(await runLevel(concurrency));
  }
} finally {
  serverProcess?.kill();
}

const failed = report.some((row) => row.rejected > 0 || row.failedHttpOrSlow > 0);
console.table(report);
console.log(`Load test runtime: ${Math.round(performance.now() - started)}ms`);

if (failed) {
  console.error(`Load test failed: at least one request failed or exceeded ${slowRequestThresholdMs}ms.`);
  process.exit(1);
}

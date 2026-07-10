import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const baseUrl = process.env.STOCKPILOT_QA_BASE_URL ?? "http://localhost:3010";
const serverPort = new URL(baseUrl).port || "3010";
const requiredPeakConcurrency = 2000;
const levels = (process.env.STOCKPILOT_STRESS_LEVELS ?? "100,200,250,500,1000,2000")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const timeoutMs = Number(process.env.STOCKPILOT_STRESS_TIMEOUT_MS) || 15000;
const socketLimit = Number(process.env.STOCKPILOT_STRESS_SOCKETS) || 256;
const slowThresholdMs = Number(process.env.STOCKPILOT_STRESS_SLOW_MS) || 15000;
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
  "/api/market/quotes?symbols=NVDA,AAPL,MSFT,BTC-USD,ETH-USD",
  "/manifest.webmanifest"
];

const agentOptions = {
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxFreeSockets: socketLimit,
  maxSockets: socketLimit,
  timeout: timeoutMs
};
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

function isLocalBaseUrl() {
  const { hostname } = new URL(baseUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

if (!levels.includes(requiredPeakConcurrency)) {
  throw new Error(`Stress test must include ${requiredPeakConcurrency} active users.`);
}

if (!isLocalBaseUrl() && process.env.STOCKPILOT_QA_ALLOW_REMOTE_2000 !== "true") {
  throw new Error(
    "2,000 active-user stress tests are blocked for remote URLs by default. Set STOCKPILOT_QA_ALLOW_REMOTE_2000=true only when you intentionally want to stress a remote deployment."
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

function requestOnce(path, virtualUser, userAgent = "StockPilot-QA-StressTest/1.0") {
  const url = new URL(path, baseUrl);
  const transport = url.protocol === "https:" ? https : http;
  const agent = url.protocol === "https:" ? httpsAgent : httpAgent;
  const started = performance.now();

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        agent,
        headers: {
          "User-Agent": userAgent,
          "X-Forwarded-For": `10.246.${Math.floor(virtualUser / 255)}.${virtualUser % 255}`
        },
        method: "GET",
        timeout: timeoutMs
      },
      (response) => {
        let bytes = 0;

        response.on("data", (chunk) => {
          bytes += chunk.length;
        });
        response.on("end", () => {
          resolve({
            path,
            status: response.statusCode ?? 0,
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 400),
            duration: performance.now() - started,
            bytes
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    request.on("error", reject);
    request.end();
  });
}

function isTransientTransportError(error) {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return error.code === "ECONNRESET" || error.code === "EPIPE";
}

async function requestWithRetry(path, virtualUser) {
  const started = performance.now();
  let retries = 0;

  while (true) {
    try {
      const result = await requestOnce(path, virtualUser);
      return { ...result, duration: performance.now() - started, retries };
    } catch (error) {
      if (!isTransientTransportError(error) || retries >= 2) throw error;
      retries += 1;
      await wait(25 * retries + Math.floor(Math.random() * 25));
    }
  }
}

async function canReachServer() {
  try {
    const response = await requestOnce("/", 1, "StockPilot-QA-StressTest/healthcheck");
    return response.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await canReachServer()) return null;

  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("Production build missing. Run npm run build before npm run test:stress.");
  }

  const child = spawn("npm", ["run", "start", "--", "-p", serverPort], {
    cwd: process.cwd(),
    stdio: ["ignore", "inherit", "inherit"],
    shell: false
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await wait(500);
    if (await canReachServer()) return child;
  }

  child.kill();
  throw new Error(`Server did not become reachable at ${baseUrl}`);
}

async function runLevel(concurrency) {
  const batch = Array.from({ length: concurrency }, (_, index) => requestWithRetry(paths[index % paths.length], index + 1));
  const results = await Promise.allSettled(batch);
  const fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const rejected = results.filter((result) => result.status === "rejected");
  const failures = fulfilled.filter((result) => !result.ok || result.duration > slowThresholdMs);
  const durations = fulfilled.map((result) => result.duration);

  return {
    concurrency,
    requests: results.length,
    rejected: rejected.length,
    retries: fulfilled.reduce((total, result) => total + result.retries, 0),
    errors: rejected.reduce((acc, result) => {
      const reason = result.reason;
      const key = reason instanceof Error
        ? `${"code" in reason && typeof reason.code === "string" ? reason.code : reason.name}: ${reason.message}`
        : String(reason);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    failedHttpOrSlow: failures.length,
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    p99: Math.round(percentile(durations, 99)),
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
  for (const concurrency of levels) {
    report.push(await runLevel(concurrency));
  }
} finally {
  serverProcess?.kill();
  httpAgent.destroy();
  httpsAgent.destroy();
}

const failed = report.some((row) => row.rejected > 0 || row.failedHttpOrSlow > 0);
console.table(report);
console.log(`Stress test runtime: ${Math.round(performance.now() - started)}ms`);
console.log(`Stress socket pool: ${socketLimit} keep-alive sockets, timeout ${timeoutMs}ms`);

if (failed) {
  console.error("Stress test failed: at least one request failed or exceeded the configured threshold.");
  process.exit(1);
}

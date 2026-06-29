import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const baseUrl = process.env.STOCKPILOT_QA_BASE_URL ?? "http://localhost:3010";
const serverPort = new URL(baseUrl).port || "3010";
const concurrencies = [1, 10, 25, 50, 100, 200];
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
    const response = await fetch(baseUrl, { method: "GET" });
    return response.status < 500;
  } catch {
    return false;
  }
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
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "User-Agent": "StockPilot-QA-LoadTest/1.0",
      "X-Forwarded-For": `10.240.${Math.floor(virtualUser / 255)}.${virtualUser % 255}`
    }
  });
  const text = await response.text();
  const duration = performance.now() - started;

  return {
    path,
    status: response.status,
    ok: response.ok,
    duration,
    bytes: text.length
  };
}

async function runLevel(concurrency) {
  const batch = Array.from({ length: concurrency }, (_, index) => hit(paths[index % paths.length], index + 1));
  const results = await Promise.allSettled(batch);
  const fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const rejected = results.filter((result) => result.status === "rejected");
  const failures = fulfilled.filter((result) => !result.ok || result.duration > 3500);
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
  console.error("Load test failed: at least one request failed or exceeded 3500ms.");
  process.exit(1);
}

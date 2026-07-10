import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const basePort = Number(process.env.STOCKPILOT_CHAOS_BASE_PORT) || 3020;
const timeoutMs = Number(process.env.STOCKPILOT_CHAOS_TIMEOUT_MS) || 8000;
const concurrency = Number(process.env.STOCKPILOT_CHAOS_CONCURRENCY) || 24;
const agentOptions = {
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxFreeSockets: 32,
  maxSockets: 64,
  timeout: timeoutMs
};
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

const basePaths = [
  "/",
  "/api/market/overview",
  "/api/market/quotes?symbols=NVDA,AAPL,MSFT,BTC-USD,ETH-USD",
  "/api/assets/NVDA",
  "/api/assets/BTC-USD",
  "/api/news?symbol=NVDA",
  "/api/ai/analysis?symbol=NVDA",
  "/assets/NVDA",
  "/assets/BTC-USD",
  "/manifest.webmanifest"
];

const guardrailPaths = [
  { path: "/api/assets/%3Cscript%3E", allowed: [400] },
  { path: "/api/market/quotes?symbols=%3Cscript%3E", allowed: [400] },
  { path: "/api/market/stream", allowed: [400] }
];

const scenarios = [
  {
    name: "mock-baseline",
    env: {
      MARKET_DATA_PROVIDER: "mock",
      STOCKPILOT_CRYPTO_PROVIDER: "none"
    },
    expectMockOrFallback: true
  },
  {
    name: "missing-primary-provider-key",
    env: {
      MARKET_DATA_PROVIDER: "finnhub",
      FINNHUB_API_KEY: "",
      STOCKPILOT_CRYPTO_PROVIDER: "none"
    },
    expectMockOrFallback: true
  },
  {
    name: "slow-provider-deadline",
    env: {
      MARKET_DATA_PROVIDER: "finnhub",
      FINNHUB_API_KEY: "invalid-chaos-key",
      STOCKPILOT_CRYPTO_PROVIDER: "none",
      STOCKPILOT_DASHBOARD_QUOTE_TIMEOUT_MS: "175",
      STOCKPILOT_ASSET_QUOTE_TIMEOUT_MS: "225",
      STOCKPILOT_QUOTE_CACHE_TTL_MS: "1000"
    },
    expectMockOrFallback: true
  },
  {
    name: "crypto-provider-disabled",
    env: {
      MARKET_DATA_PROVIDER: "mock",
      STOCKPILOT_CRYPTO_PROVIDER: "none"
    },
    expectMockOrFallback: true
  }
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}

function requestOnce(baseUrl, path, virtualUser, allowed = null) {
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
          "User-Agent": "StockPilot-QA-ChaosTest/1.0",
          "X-Forwarded-For": `10.247.${Math.floor(virtualUser / 255)}.${virtualUser % 255}`
        },
        method: "GET",
        timeout: timeoutMs
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = response.statusCode ?? 0;
          const ok = allowed ? allowed.includes(status) : status >= 200 && status < 400;

          resolve({
            body,
            bytes: Buffer.byteLength(body),
            duration: performance.now() - started,
            ok,
            path,
            status
          });
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error(`Request timeout after ${timeoutMs}ms`)));
    request.on("error", reject);
    request.end();
  });
}

async function canReachServer(baseUrl) {
  try {
    const response = await requestOnce(baseUrl, "/", 1);
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startServer(port, env) {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("Production build missing. Run npm run build before npm run test:chaos.");
  }

  const child = spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
      PORT: String(port)
    },
    stdio: "ignore",
    shell: false
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    await wait(250);
    if (await canReachServer(baseUrl)) return { baseUrl, child };
  }

  child.kill();
  throw new Error(`Chaos server did not become reachable at ${baseUrl}`);
}

async function runScenario(scenario, index) {
  const port = basePort + index;
  const { baseUrl, child } = await startServer(port, scenario.env);

  try {
    const wave = Array.from({ length: concurrency }, (_, requestIndex) =>
      requestOnce(baseUrl, basePaths[requestIndex % basePaths.length], requestIndex + 1)
    );
    const guardrails = guardrailPaths.map((item, requestIndex) =>
      requestOnce(baseUrl, item.path, concurrency + requestIndex + 1, item.allowed)
    );
    const results = await Promise.allSettled([...wave, ...guardrails]);
    const fulfilled = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const rejected = results.filter((result) => result.status === "rejected");
    const unexpected = fulfilled.filter((result) => !result.ok || result.status >= 500);
    const durations = fulfilled.map((result) => result.duration);
    const combinedBody = fulfilled.map((result) => result.body).join("\n");
    const fallbackSeen = /Mock|Mock-Daten|Fallback|Server-Cache|algorithmische|Keine Anlageberatung/i.test(combinedBody);

    return {
      scenario: scenario.name,
      requests: results.length,
      rejected: rejected.length,
      unexpected: unexpected.length,
      fallbackSeen: scenario.expectMockOrFallback ? fallbackSeen : true,
      p50: Math.round(percentile(durations, 50)),
      p95: Math.round(percentile(durations, 95)),
      max: Math.round(Math.max(...durations, 0)),
      statuses: fulfilled.reduce((acc, result) => {
        acc[result.status] = (acc[result.status] ?? 0) + 1;
        return acc;
      }, {})
    };
  } finally {
    child.kill();
    await wait(250);
  }
}

async function runRateLimitScenario() {
  const port = basePort + scenarios.length + 1;
  const { baseUrl, child } = await startServer(port, {
    MARKET_DATA_PROVIDER: "mock",
    STOCKPILOT_CRYPTO_PROVIDER: "none"
  });

  try {
    const fixedIp = "10.248.0.1";
    const burst = Array.from({ length: 140 }, (_, index) => {
      const url = new URL("/api/portfolio", baseUrl);
      const started = performance.now();

      return new Promise((resolve, reject) => {
        const request = http.request(
          url,
          {
            agent: httpAgent,
            headers: {
              "User-Agent": "StockPilot-QA-ChaosTest/rate-limit",
              "X-Forwarded-For": fixedIp
            },
            method: "POST",
            timeout: timeoutMs
          },
          (response) => {
            response.resume();
            response.on("end", () => {
              resolve({
                status: response.statusCode ?? 0,
                duration: performance.now() - started,
                index
              });
            });
          }
        );

        request.on("timeout", () => request.destroy(new Error(`Request timeout after ${timeoutMs}ms`)));
        request.on("error", reject);
        request.end();
      });
    });
    const results = await Promise.allSettled(burst);
    const fulfilled = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const rejected = results.filter((result) => result.status === "rejected");
    const statuses = fulfilled.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      scenario: "rate-limit-burst",
      requests: results.length,
      rejected: rejected.length,
      unexpected: fulfilled.filter((result) => result.status >= 500).length,
      fallbackSeen: Boolean(statuses[429]),
      p50: Math.round(percentile(fulfilled.map((result) => result.duration), 50)),
      p95: Math.round(percentile(fulfilled.map((result) => result.duration), 95)),
      max: Math.round(Math.max(...fulfilled.map((result) => result.duration), 0)),
      statuses
    };
  } finally {
    child.kill();
    await wait(250);
  }
}

const started = performance.now();
const report = [];

for (let index = 0; index < scenarios.length; index += 1) {
  report.push(await runScenario(scenarios[index], index));
}
report.push(await runRateLimitScenario());

httpAgent.destroy();
httpsAgent.destroy();

console.table(report);
console.log(`Chaos test runtime: ${Math.round(performance.now() - started)}ms`);

const failed = report.some(
  (row) => row.rejected > 0 || row.unexpected > 0 || row.fallbackSeen !== true
);

if (failed) {
  console.error("Chaos test failed: unexpected rejection/status or missing fallback signal.");
  process.exit(1);
}

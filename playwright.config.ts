import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3011";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run start -- -p 3011",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      ...process.env,
      MARKET_DATA_PROVIDER: "mock",
      STOCKPILOT_MARKET_PROVIDER: "mock",
      STOCKPILOT_QUOTE_PROVIDER: "mock",
      STOCKPILOT_CRYPTO_PROVIDER: "mock",
      STOCKPILOT_NEWS_PROVIDER: "mock",
      STOCKPILOT_FUNDAMENTALS_PROVIDER: "mock",
      STOCKPILOT_AI_PROVIDER: "mock",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      STOCKPILOT_INTELLIGENCE_READ_TIMEOUT_MS: "500"
    }
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

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
    timeout: 90_000
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

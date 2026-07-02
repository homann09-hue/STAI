import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.stockpilot.ai",
  appName: "StockPilot AI",
  webDir: "out",
  server: {
    url: "https://stockpilot-ai-beta.vercel.app",
    cleartext: false
  }
};

export default config;

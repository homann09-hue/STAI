import type { CapacitorConfig } from "@capacitor/cli";

function getCapacitorServerUrl() {
  const rawUrl = process.env.CAPACITOR_SERVER_URL?.trim();
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !url.hostname) return undefined;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

const serverUrl = getCapacitorServerUrl();

const config: CapacitorConfig = {
  appId: "com.stockpilot.ai",
  appName: "StockPilot AI",
  webDir: "out",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false
        }
      }
    : {})
};

export default config;

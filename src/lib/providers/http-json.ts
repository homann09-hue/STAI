const DEFAULT_PROVIDER_JSON_MAX_BYTES = 1_500_000;
const DEFAULT_ALLOWED_PROVIDER_HOSTS = [
  // Bewusst der exakte Host statt "europa.eu": eine Domain-Freigabe wuerde
  // jeden EU-Subdomainserver zum erlaubten Ziel machen.
  "data-api.ecb.europa.eu",
  "alphavantage.co",
  "binance.com",
  "coinbase.com",
  "databento.com",
  "eodhd.com",
  "eodhistoricaldata.com",
  // Nur der Datenhost der St. Louis Fed. Bewusst nicht "stlouisfed.org":
  // eine Domain-Freigabe wuerde jeden Subdomainserver zum erlaubten Ziel
  // machen -- dieselbe Regel wie bei der EZB.
  "fred.stlouisfed.org",
  "financialmodelingprep.com",
  "finnhub.io",
  "marketaux.com",
  "massive.com",
  "newsapi.org",
  "polygon.io",
  "twelvedata.com"
];

function providerJsonMaxBytes() {
  const configured = Number(process.env.STOCKPILOT_PROVIDER_JSON_MAX_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_PROVIDER_JSON_MAX_BYTES;
  return Math.min(Math.max(configured, 64_000), 5_000_000);
}

function isJsonContentType(contentType: string | null) {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json") || normalized.includes("text/json");
}

function configuredAllowedProviderHosts() {
  return (process.env.STOCKPILOT_ALLOWED_PROVIDER_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host) && host.length <= 253)
    .slice(0, 25);
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  if (
    normalized === "localhost" ||
    normalized === "metadata.google.internal" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  ) {
    return true;
  }

  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function isAllowedProviderHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (isPrivateHostname(normalized)) return false;

  const allowedHosts = [...DEFAULT_ALLOWED_PROVIDER_HOSTS, ...configuredAllowedProviderHosts()];
  return allowedHosts.some((allowedHost) => normalized === allowedHost || normalized.endsWith(`.${allowedHost}`));
}

export async function readBoundedResponseText(
  response: Response,
  providerName: string,
  maxBytes: number,
  // Standard bleibt die JSON-Pflicht. Nur wer ausdruecklich ein anderes Format
  // erwartet, darf sie abschalten -- sonst wuerde ein Provider, der still auf
  // eine HTML-Fehlerseite umschaltet, unbemerkt durchrutschen.
  options: { expectedContentType?: "json" | "csv" } = {}
) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`${providerName} Antwort ist zu groß.`);
  }

  const contentType = response.headers.get("content-type");

  if (options.expectedContentType === "csv") {
    if (contentType && !contentType.toLowerCase().includes("csv")) {
      throw new Error(`${providerName} lieferte keine CSV-Antwort.`);
    }
  } else if (!isJsonContentType(contentType)) {
    throw new Error(`${providerName} lieferte keine JSON-Antwort.`);
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error(`${providerName} Antwort ist zu groß.`);
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchBoundedProviderJson<T>(
  url: URL,
  providerName: string,
  options: { timeoutMs?: number; userAgent?: string; maxBytes?: number } = {}
): Promise<{ data: T; latencyMs: number }> {
  if (url.protocol !== "https:") {
    throw new Error(`${providerName} Provider-URL muss HTTPS verwenden.`);
  }

  if (!isAllowedProviderHost(url.hostname)) {
    throw new Error(`${providerName} Provider-Host ist nicht freigegeben.`);
  }

  const timeoutMs = Math.max(750, Math.min(15000, options.timeoutMs ?? 6500));
  const maxBytes = options.maxBytes ?? providerJsonMaxBytes();
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent ?? "StockPilotAI/0.1 provider-layer"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${providerName} HTTP ${response.status}`);
    }

    const text = await readBoundedResponseText(response, providerName, maxBytes);

    try {
      return {
        data: JSON.parse(text) as T,
        latencyMs: Date.now() - started
      };
    } catch {
      throw new Error(`${providerName} lieferte ungültiges JSON.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Wie `fetchBoundedProviderJson`, nur fuer Antworten, die kein JSON sind.
 *
 * Die EZB liefert ihre Zeitreihen als SDMX-CSV. Das SDMX-JSON derselben Daten
 * ist um ein Vielfaches groesser und muss trotzdem entpackt werden, bringt also
 * keinen Gewinn. Alle Schutzmassnahmen bleiben identisch: HTTPS erzwungen,
 * Host-Allowlist, Zeitlimit und Groessenbegrenzung.
 */
export async function fetchBoundedProviderText(
  url: URL,
  providerName: string,
  options: { timeoutMs?: number; userAgent?: string; maxBytes?: number; accept?: string } = {}
): Promise<{ text: string; latencyMs: number }> {
  if (url.protocol !== "https:") {
    throw new Error(`${providerName} Provider-URL muss HTTPS verwenden.`);
  }

  if (!isAllowedProviderHost(url.hostname)) {
    throw new Error(`${providerName} Provider-Host ist nicht freigegeben.`);
  }

  const timeoutMs = Math.max(750, Math.min(15000, options.timeoutMs ?? 6500));
  const maxBytes = options.maxBytes ?? providerJsonMaxBytes();
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: options.accept ?? "text/csv",
        "User-Agent": options.userAgent ?? "StockPilotAI/0.1 provider-layer"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${providerName} HTTP ${response.status}`);
    }

    return {
      text: await readBoundedResponseText(response, providerName, maxBytes, { expectedContentType: "csv" }),
      latencyMs: Date.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

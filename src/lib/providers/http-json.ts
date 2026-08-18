import {
  createProviderRequestKey,
  executeProviderRequest,
} from "@/lib/provider-resilience";

const DEFAULT_PROVIDER_JSON_MAX_BYTES = 1_500_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ALLOWED_PROVIDER_HOSTS = [
  // Bewusst der exakte Host statt "europa.eu": eine Domain-Freigabe wuerde
  // jeden EU-Subdomainserver zum erlaubten Ziel machen.
  "data-api.ecb.europa.eu",
  "alphavantage.co",
  "api.alpaca.markets",
  "binance.com",
  "coinbase.com",
  "databento.com",
  "eodhd.com",
  "eodhistoricaldata.com",
  // Nur die beiden benoetigten Hosts der St. Louis Fed. Bewusst nicht
  // "stlouisfed.org": eine Domain-Freigabe wuerde jeden Subdomainserver zum
  // erlaubten Ziel machen -- dieselbe Regel wie bei der EZB.
  "api.stlouisfed.org",
  "fred.stlouisfed.org",
  "financialmodelingprep.com",
  "finnhub.io",
  "marketaux.com",
  "massive.com",
  "newsapi.org",
  "polygon.io",
  "data.alpaca.markets",
  "paper-api.alpaca.markets",
  "twelvedata.com",
  // Zwei einzelne Hosts der SEC statt "sec.gov": `data.sec.gov` liefert die
  // Einreichungsliste, `www.sec.gov` die Originaldokumente.
  "data.sec.gov",
  "www.sec.gov"
];

export class ProviderHttpResponseError extends Error {
  constructor(
    readonly providerName: string,
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(`${providerName} HTTP ${status}`);
    this.name = "ProviderHttpResponseError";
  }
}

export type ProviderJsonResponse<T> = {
  data: T;
  latencyMs: number;
  /** Nur explizit freigegebene, unkritische Antwortheader. */
  responseHeaders: Record<string, string>;
};

export type ProviderJsonRequestOptions<T> = {
  timeoutMs?: number;
  userAgent?: string;
  maxBytes?: number;
  /** Serverseitiger Authorization-Wert; wird weder URL noch Request-Key. */
  authorization?: string;
  /** Serverseitige Provider-Header. Nur explizit erlaubte Namen passieren. */
  requestHeaders?: Readonly<Record<string, string>>;
  /** Erlaubt Validierung im Resilience-Scope, damit Body-Fehler retried werden. */
  parseJson?: (value: unknown) => T;
  captureResponseHeaders?: readonly string[];
};

const ALLOWED_PROVIDER_REQUEST_HEADERS = new Set([
  "apca-api-key-id",
  "apca-api-secret-key",
  "x-finnhub-token",
]);

function safeProviderRequestHeaders(
  headers: Readonly<Record<string, string>> | undefined,
) {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).flatMap(([name, value]) => {
      const normalized = name.trim().toLowerCase();
      if (!ALLOWED_PROVIDER_REQUEST_HEADERS.has(normalized)) return [];
      if (!value || /[\r\n]/.test(value)) return [];
      return [[name, value] as const];
    }),
  );
}

function parseRetryAfterMs(value: string | null, nowMs = Date.now()) {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(seconds * 1000));
  }

  const retryAtMs = Date.parse(value);
  if (!Number.isFinite(retryAtMs)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAtMs - nowMs));
}

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
  options: { expectedContentType?: "json" | "csv" | "xml" } = {}
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
  } else if (options.expectedContentType === "xml") {
    // Die SEC liefert Form-4-Meldungen als XML. Ohne diesen Zweig haette die
    // CSV-Pruefung jeden Abruf abgewiesen -- ein Fehler, der erst beim
    // Verdrahten aufgefallen ist.
    if (contentType && !/xml|text\/plain/i.test(contentType)) {
      throw new Error(`${providerName} lieferte keine XML-Antwort.`);
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
  options: ProviderJsonRequestOptions<T> = {}
): Promise<ProviderJsonResponse<T>> {
  if (url.protocol !== "https:") {
    throw new Error(`${providerName} Provider-URL muss HTTPS verwenden.`);
  }

  if (!isAllowedProviderHost(url.hostname)) {
    throw new Error(`${providerName} Provider-Host ist nicht freigegeben.`);
  }

  return executeProviderRequest(
    {
      providerName,
      requestKey: createProviderRequestKey(url, "json"),
      operation: "fetch_json",
    },
    async () => {
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
            "User-Agent": options.userAgent ?? "StockPilotAI/0.1 provider-layer",
            ...(options.authorization
              ? { Authorization: options.authorization }
              : {}),
            ...safeProviderRequestHeaders(options.requestHeaders),
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new ProviderHttpResponseError(
            providerName,
            response.status,
            parseRetryAfterMs(response.headers.get("retry-after"))
          );
        }

        const text = await readBoundedResponseText(response, providerName, maxBytes);

        let decoded: unknown;
        try {
          decoded = JSON.parse(text) as unknown;
        } catch {
          throw new Error(`${providerName} lieferte ungültiges JSON.`);
        }

        // Domainfehler aus einem Parser bleiben im Resilience-Scope. So
        // erkennt die zentrale Logik auch HTTP-200-Antworten mit code=429.
        const data = options.parseJson
          ? options.parseJson(decoded)
          : (decoded as T);
        const responseHeaders = Object.fromEntries(
          (options.captureResponseHeaders ?? [])
            .map((name) => name.trim().toLowerCase())
            .filter(
              (name) =>
                /^[a-z0-9-]{1,64}$/.test(name) &&
                !["authorization", "cookie", "set-cookie"].includes(name),
            )
            .slice(0, 12)
            .flatMap((name) => {
              const value = response.headers.get(name);
              return value === null ? [] : [[name, value] as const];
            }),
        );
        return {
          data,
          latencyMs: Date.now() - started,
          responseHeaders,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  );
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
  options: {
    timeoutMs?: number;
    userAgent?: string;
    maxBytes?: number;
    accept?: string;
    /** Erwartetes Format. Standard bleibt CSV, damit bestehende Aufrufe gleich bleiben. */
    expectedContentType?: "csv" | "xml";
  } = {}
): Promise<{ text: string; latencyMs: number }> {
  if (url.protocol !== "https:") {
    throw new Error(`${providerName} Provider-URL muss HTTPS verwenden.`);
  }

  if (!isAllowedProviderHost(url.hostname)) {
    throw new Error(`${providerName} Provider-Host ist nicht freigegeben.`);
  }

  return executeProviderRequest(
    {
      providerName,
      requestKey: createProviderRequestKey(url, "text"),
      operation: "fetch_text",
    },
    async () => {
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
          throw new ProviderHttpResponseError(
            providerName,
            response.status,
            parseRetryAfterMs(response.headers.get("retry-after"))
          );
        }

        return {
          text: await readBoundedResponseText(response, providerName, maxBytes, {
            expectedContentType: options.expectedContentType ?? "csv"
          }),
          latencyMs: Date.now() - started
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  );
}

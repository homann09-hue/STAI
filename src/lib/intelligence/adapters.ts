import { createHash } from "node:crypto";
import { z } from "zod";
import { rawSourceEventSchema } from "@/lib/intelligence/schemas";
import type {
  AdapterBatch,
  AdapterCursor,
  AdapterFetchRequest,
  IntelligenceSourceAdapter,
  RawSourceEvent,
  SecEntityRequest
} from "@/lib/intelligence/types";

type FetchLike = typeof fetch;

export class ProviderAdapterError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ProviderAdapterError";
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response | null, attempt: number, baseDelayMs: number) {
  const retryAfter = Number(response?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  const jitter = baseDelayMs > 0 ? Math.floor(Math.random() * Math.min(baseDelayMs, 250)) : 0;
  return Math.min(baseDelayMs * 2 ** attempt + jitter, 10_000);
}

export async function fetchJsonWithRetry<T>(
  url: URL,
  provider: string,
  options: {
    headers?: HeadersInit;
    timeoutMs?: number;
    maxAttempts?: number;
    baseDelayMs?: number;
    maxBytes?: number;
    fetchImpl?: FetchLike;
  } = {}
): Promise<T> {
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 750), 20_000);
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 4);
  const baseDelayMs = Math.max(options.baseDelayMs ?? 300, 0);
  const maxBytes = Math.min(Math.max(options.maxBytes ?? 2_000_000, 64_000), 5_000_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  let lastError: ProviderAdapterError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | null = null;

    try {
      response = await fetchImpl(url, {
        cache: "no-store",
        headers: { Accept: "application/json", ...options.headers },
        signal: controller.signal
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new ProviderAdapterError(provider, `${provider} antwortete mit HTTP ${response.status}.`, response.status, retryable);
        if (!retryable || attempt === maxAttempts - 1) throw lastError;
        await sleep(retryDelayMs(response, attempt, baseDelayMs));
        continue;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new ProviderAdapterError(provider, `${provider} lieferte eine zu große Antwort.`, response.status, false);
      }

      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new ProviderAdapterError(provider, `${provider} lieferte eine zu große Antwort.`, response.status, false);
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ProviderAdapterError(provider, `${provider} lieferte ungültiges JSON.`, response.status, false);
      }
    } catch (error) {
      if (error instanceof ProviderAdapterError) {
        if (!error.retryable || attempt === maxAttempts - 1) throw error;
        lastError = error;
      } else {
        lastError = new ProviderAdapterError(provider, `${provider} ist derzeit nicht erreichbar.`, null, true);
        if (attempt === maxAttempts - 1) throw lastError;
      }

      await sleep(retryDelayMs(response, attempt, baseDelayMs));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new ProviderAdapterError(provider, `${provider} konnte nicht geladen werden.`, null, true);
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || fallback;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeTimestamp(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function safeSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9.^:_/=-]/g, "").slice(0, 24);
  return normalized || null;
}

function fallbackExternalId(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function cursorValue(cursor: AdapterCursor | undefined, key?: string) {
  if (typeof cursor === "string") return cursor;
  if (cursor && key) return cursor[key] ?? null;
  return null;
}

const fmpNewsPayloadSchema = z.array(
  z
    .object({
      symbol: z.string().optional(),
      publishedDate: z.string().optional(),
      title: z.string().optional(),
      image: z.string().optional(),
      site: z.string().optional(),
      text: z.string().optional(),
      url: z.string().optional()
    })
    .passthrough()
);

export class FmpNewsAdapter implements IntelligenceSourceAdapter {
  readonly descriptor = {
    provider: "fmp",
    sourceType: "company_news" as const,
    name: "Financial Modeling Prep Stock News",
    baseUrl: "https://financialmodelingprep.com/stable",
    priority: 10,
    trustScore: 0.72,
    latencyClass: "near_real_time" as const
  };

  constructor(
    private readonly options: {
      apiKey?: string;
      fetchImpl?: FetchLike;
      baseDelayMs?: number;
    } = {}
  ) {}

  async fetchBatch(request: AdapterFetchRequest): Promise<AdapterBatch> {
    const apiKey = this.options.apiKey ?? process.env.FMP_API_KEY;
    if (!apiKey) throw new ProviderAdapterError("FMP", "FMP_API_KEY fehlt.", null, false);

    const receivedAt = new Date().toISOString();
    const symbols = [...new Set((request.symbols ?? []).map(safeSymbol).filter((value): value is string => Boolean(value)))].slice(0, 25);
    const endpoint = symbols.length ? "/news/stock" : "/news/stock-latest";
    const url = new URL(`${this.descriptor.baseUrl}${endpoint}`);
    if (symbols.length) url.searchParams.set("symbols", symbols.join(","));
    url.searchParams.set("page", "0");
    url.searchParams.set("limit", String(Math.min(Math.max(request.limit ?? 25, 1), 100)));
    url.searchParams.set("apikey", apiKey);

    const payload = await fetchJsonWithRetry<unknown>(url, "FMP", {
      fetchImpl: this.options.fetchImpl,
      baseDelayMs: this.options.baseDelayMs,
      headers: { "User-Agent": "StockPilotAI/1.0 intelligence-fmp-adapter" }
    });
    const parsed = fmpNewsPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderAdapterError("FMP", "FMP lieferte ein unerwartetes News-Schema.", null, false);

    const events = parsed.data.flatMap<RawSourceEvent>((item) => {
      const sourceUrl = safeHttpsUrl(item.url);
      const title = cleanText(item.title, "", 500);
      if (!sourceUrl || !title) return [];
      const publishedAt = safeTimestamp(item.publishedDate, receivedAt);
      const symbol = safeSymbol(item.symbol);
      const externalId = fallbackExternalId([sourceUrl, title, publishedAt]);

      const candidate = {
        provider: "fmp",
        externalId,
        sourceType: "company_news" as const,
        sourceUrl,
        publisher: cleanText(item.site, "FMP News Source", 160),
        publishedAt,
        receivedAt,
        language: "en",
        title,
        rawText: cleanText(item.text, title, 200_000),
        symbols: symbol ? [symbol] : symbols,
        companyNames: [],
        metadata: { imageUrl: safeHttpsUrl(item.image), providerDataset: "stock-news" },
        rawPayload: { ...item, image: safeHttpsUrl(item.image) },
        credibilityMetadata: {
          trustScore: this.descriptor.trustScore,
          isPrimarySource: false,
          isOfficialSource: false,
          confirmationHint: "unconfirmed" as const
        }
      };

      const validated = rawSourceEventSchema.safeParse(candidate);
      return validated.success ? [validated.data] : [];
    });

    const previousCursor = cursorValue(request.cursor);
    const cursorIndex = previousCursor ? events.findIndex((event) => event.externalId === previousCursor) : -1;
    const unseenEvents = previousCursor ? (cursorIndex >= 0 ? events.slice(0, cursorIndex) : events) : events;

    return {
      events: unseenEvents,
      nextCursor: events[0]?.externalId ?? previousCursor,
      receivedAt
    };
  }
}

const secSubmissionSchema = z
  .object({
    cik: z.string(),
    name: z.string(),
    tickers: z.array(z.string()).default([]),
    exchanges: z.array(z.string()).default([]),
    formerNames: z.array(z.object({ name: z.string().optional() }).passthrough()).default([]),
    filings: z.object({
      recent: z.object({
        accessionNumber: z.array(z.string()).default([]),
        filingDate: z.array(z.string()).default([]),
        reportDate: z.array(z.string()).default([]),
        acceptanceDateTime: z.array(z.string()).default([]),
        form: z.array(z.string()).default([]),
        primaryDocument: z.array(z.string()).default([]),
        primaryDocDescription: z.array(z.string()).default([])
      })
    })
  })
  .passthrough();

const supportedSecForms = new Set(["8-K", "8-K/A", "10-Q", "10-Q/A", "10-K", "10-K/A", "4", "4/A", "SC 13D", "SC 13D/A", "SC 13G", "SC 13G/A", "13F-HR", "13F-HR/A"]);

function secCursorMap(cursor: AdapterCursor | undefined) {
  return cursor && typeof cursor === "object" ? { ...cursor } : {};
}

function secArchiveUrl(cik: string, accessionNumber: string, primaryDocument: string) {
  const cikPath = cik.replace(/^0+/, "") || "0";
  const accessionPath = accessionNumber.replace(/-/g, "");
  const document = primaryDocument.replace(/[^A-Za-z0-9._-]/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}/${document}`;
}

export class SecEdgarAdapter implements IntelligenceSourceAdapter {
  readonly descriptor = {
    provider: "sec_edgar",
    sourceType: "regulatory_filing" as const,
    name: "SEC EDGAR Submissions",
    baseUrl: "https://data.sec.gov/submissions",
    priority: 5,
    trustScore: 1,
    latencyClass: "near_real_time" as const
  };

  private lastRequestAt = 0;

  constructor(
    private readonly options: {
      userAgent?: string;
      fetchImpl?: FetchLike;
      baseDelayMs?: number;
      minimumIntervalMs?: number;
      timeoutMs?: number;
      maxAttempts?: number;
    } = {}
  ) {}

  private async respectFairAccess() {
    const minimumIntervalMs = Math.max(this.options.minimumIntervalMs ?? 125, 100);
    const waitMs = Math.max(0, this.lastRequestAt + minimumIntervalMs - Date.now());
    if (waitMs) await sleep(waitMs);
    this.lastRequestAt = Date.now();
  }

  private async fetchEntity(entity: SecEntityRequest, request: AdapterFetchRequest, receivedAt: string) {
    const userAgent = this.options.userAgent ?? process.env.SEC_EDGAR_USER_AGENT;
    if (!userAgent || !/@/.test(userAgent)) {
      throw new ProviderAdapterError("SEC EDGAR", "SEC_EDGAR_USER_AGENT mit Kontakt-E-Mail fehlt.", null, false);
    }

    const cik = entity.cik.replace(/\D/g, "").padStart(10, "0").slice(-10);
    await this.respectFairAccess();
    const payload = await fetchJsonWithRetry<unknown>(new URL(`${this.descriptor.baseUrl}/CIK${cik}.json`), "SEC EDGAR", {
      fetchImpl: this.options.fetchImpl,
      baseDelayMs: this.options.baseDelayMs,
      timeoutMs: this.options.timeoutMs ?? Number(process.env.STOCKPILOT_INTELLIGENCE_READ_TIMEOUT_MS || 2_500),
      maxAttempts: this.options.maxAttempts ?? 1,
      headers: {
        "User-Agent": userAgent,
        "Accept-Encoding": "gzip, deflate"
      }
    });
    const parsed = secSubmissionSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderAdapterError("SEC EDGAR", "SEC EDGAR lieferte ein unerwartetes Submissions-Schema.", null, false);

    const recent = parsed.data.filings.recent;
    const currentCursor = cursorValue(request.cursor, cik);
    const limit = Math.min(Math.max(request.limit ?? 25, 1), 100);
    const events: RawSourceEvent[] = [];

    for (let index = 0; index < recent.accessionNumber.length && events.length < limit; index += 1) {
      const accessionNumber = recent.accessionNumber[index];
      if (!accessionNumber || accessionNumber === currentCursor) break;
      const form = recent.form[index] ?? "";
      const primaryDocument = recent.primaryDocument[index] ?? "";
      if (!supportedSecForms.has(form) || !primaryDocument) continue;

      const filingDate = recent.filingDate[index] ?? "";
      const reportDate = recent.reportDate[index] ?? "";
      const publishedAt = safeTimestamp(recent.acceptanceDateTime[index], safeTimestamp(filingDate, receivedAt));
      const sourceUrl = secArchiveUrl(cik, accessionNumber, primaryDocument);
      const symbol = safeSymbol(entity.symbol ?? parsed.data.tickers[0]);
      const companyName = cleanText(parsed.data.name, "SEC filer", 200);
      const description = cleanText(recent.primaryDocDescription[index], `${form} filing`, 300);
      const title = `${companyName}: ${form} - ${description}`.slice(0, 500);
      const rawText = `${companyName} filed form ${form} on ${filingDate || "an unspecified date"}${reportDate ? ` for reporting period ${reportDate}` : ""}.`;

      const candidate = {
        provider: "sec_edgar",
        externalId: accessionNumber,
        sourceType: "regulatory_filing" as const,
        sourceUrl,
        publisher: "U.S. Securities and Exchange Commission",
        publishedAt,
        receivedAt,
        language: "en",
        title,
        rawText,
        symbols: symbol ? [symbol] : [],
        companyNames: [companyName],
        metadata: {
          cik,
          form,
          filingDate,
          reportDate,
          accessionNumber,
          primaryDocument,
          exchanges: parsed.data.exchanges,
          formerNames: parsed.data.formerNames.map((item) => item.name).filter(Boolean)
        },
        rawPayload: {
          cik,
          companyName,
          form,
          filingDate,
          reportDate,
          acceptanceDateTime: recent.acceptanceDateTime[index] ?? null,
          accessionNumber,
          primaryDocument,
          primaryDocDescription: description
        },
        credibilityMetadata: {
          trustScore: 1,
          isPrimarySource: true,
          isOfficialSource: true,
          confirmationHint: "confirmed" as const
        }
      };
      const validated = rawSourceEventSchema.safeParse(candidate);
      if (validated.success) events.push(validated.data);
    }

    return { cik, events, nextCursor: recent.accessionNumber[0] ?? currentCursor };
  }

  async fetchBatch(request: AdapterFetchRequest): Promise<AdapterBatch> {
    const receivedAt = new Date().toISOString();
    const entities = (request.secEntities ?? []).slice(0, 10);
    if (!entities.length) return { events: [], nextCursor: request.cursor ?? null, receivedAt };

    const globalLimit = Math.min(Math.max(request.limit ?? 25, 1), 100);
    const nextCursor = secCursorMap(request.cursor);
    const events: RawSourceEvent[] = [];
    for (let index = 0; index < entities.length && events.length < globalLimit; index += 1) {
      const remaining = globalLimit - events.length;
      const remainingEntities = entities.length - index;
      const perEntityLimit = Math.max(1, Math.ceil(remaining / remainingEntities));
      const result = await this.fetchEntity(entities[index], { ...request, limit: perEntityLimit }, receivedAt);
      events.push(...result.events.slice(0, remaining));
      if (result.nextCursor) nextCursor[result.cik] = result.nextCursor;
    }

    return { events, nextCursor, receivedAt };
  }
}

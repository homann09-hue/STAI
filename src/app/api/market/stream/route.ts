import { getMarketDataProvider } from "@/lib/providers/market-provider";
import {
  REQUEST_ID_HEADER,
  jsonError,
  rateLimit,
  secureStreamHeaders,
} from "@/lib/api-guard";
import { getStreamIntervalMs } from "@/lib/cost-controls";
import { logEvent } from "@/lib/observability";
import { normalizeCanonicalQuoteRecord } from "@/lib/canonical-quote";
import {
  bindQuotesToCanonicalIdentities,
  prepareCanonicalQuoteRequest,
} from "@/lib/quote-request-identity";
import type { NormalizedQuote } from "@/lib/types";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_STREAM_INSTRUMENTS = 30;
const MAX_STREAM_QUERY_LENGTH = 6_200;
const MAX_STREAM_QUOTES_PER_EVENT = 30;
const MAX_SSE_PAYLOAD_CHARS = 64_000;
const MAX_STREAM_CONNECTION_MS = 5 * 60_000;
const STREAM_HEARTBEAT_MS = 15_000;

type ParsedRequest =
  | { ok: true; mode: "canonical"; values: string[] }
  | { ok: true; mode: "legacy_symbol"; values: string[] }
  | { ok: false; message: string };

function parseRequest(request: Request): ParsedRequest {
  const { searchParams } = new URL(request.url);
  const canonical = searchParams.get("canonicalIds") ?? "";
  const legacy = searchParams.get("symbols") ?? searchParams.get("symbol") ?? "";
  if (canonical && legacy) {
    return { ok: false, message: "canonicalIds und symbols dürfen nicht kombiniert werden." };
  }
  const raw = canonical || legacy;
  if (raw.length > MAX_STREAM_QUERY_LENGTH) {
    return { ok: false, message: "Stream-Anfrage ist zu lang." };
  }
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (!values.length) {
    return { ok: false, message: "Mindestens eine Instrument-ID ist erforderlich." };
  }
  if (values.length > MAX_STREAM_INSTRUMENTS) {
    return { ok: false, message: `Maximal ${MAX_STREAM_INSTRUMENTS} Instrumente pro Stream.` };
  }
  return { ok: true, mode: canonical ? "canonical" : "legacy_symbol", values };
}

function sse(event: string, data: unknown) {
  const payload = JSON.stringify(data);
  if (payload.length > MAX_SSE_PAYLOAD_CHARS) {
    return `event: error\ndata: ${JSON.stringify({
      message: "Stream-Payload wurde aus Sicherheitsgründen begrenzt.",
      maxPayloadChars: MAX_SSE_PAYLOAD_CHARS,
    })}\n\n`;
  }
  return `event: ${event}\ndata: ${payload}\n\n`;
}

function filterLegacyQuotes(quotes: readonly unknown[], allowedSymbols: Set<string>) {
  const safe: NormalizedQuote[] = [];
  for (const rawQuote of quotes) {
    const quote = normalizeCanonicalQuoteRecord(rawQuote);
    if (!quote || !allowedSymbols.has(quote.symbol.toUpperCase())) continue;
    safe.push(quote);
    if (safe.length >= MAX_STREAM_QUOTES_PER_EVENT) break;
  }
  return safe;
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const parsed = parseRequest(request);
  if (!parsed.ok) return jsonError(parsed.message, 400);

  let canonicalPreparation: ReturnType<typeof prepareCanonicalQuoteRequest> | null = null;
  let requestSymbols: string[];
  if (parsed.mode === "canonical") {
    canonicalPreparation = prepareCanonicalQuoteRequest(parsed.values);
    if (canonicalPreparation.status === "invalid") {
      return jsonError("Ungültige kanonische Instrument-ID.", 400);
    }
    if (canonicalPreparation.status === "provider_symbol_collision") {
      return jsonError(
        `Mehrere Listings würden beim Provider auf ${canonicalPreparation.providerSymbol} kollidieren. Provider-Mapping erforderlich.`,
        409,
      );
    }
    requestSymbols = canonicalPreparation.providerSymbols;
  } else {
    const seen = new Set<string>();
    requestSymbols = [];
    for (const rawSymbol of parsed.values) {
      const validated = validateSymbol(rawSymbol);
      if (!validated.success) return jsonError("Ungültiges Symbol.", 400);
      if (!seen.has(validated.data)) {
        seen.add(validated.data);
        requestSymbols.push(validated.data);
      }
    }
  }

  const encoder = new TextEncoder();
  const provider = getMarketDataProvider();
  const requestId = crypto.randomUUID();
  const streamIntervalMs = getStreamIntervalMs(request);
  const allowedSymbols = new Set(requestSymbols.map((symbol) => symbol.toUpperCase()));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lifetimeTimer: ReturnType<typeof setTimeout> | null = null;
      let lifetimeEnded = false;
      const streamAbortController = new AbortController();

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      }

      function stopHeartbeat() {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      }

      function stopLifetimeTimer() {
        if (lifetimeTimer) {
          clearTimeout(lifetimeTimer);
          lifetimeTimer = null;
        }
      }

      request.signal.addEventListener("abort", () => {
        closed = true;
        stopHeartbeat();
        stopLifetimeTimer();
        streamAbortController.abort();
      }, { once: true });

      lifetimeTimer = setTimeout(() => {
        lifetimeEnded = true;
        send("complete", {
          provider: provider.providerName,
          identityMode: parsed.mode,
          message: "Stream-Laufzeitlimit erreicht. Client soll die Verbindung mit Backoff neu öffnen.",
          maxConnectionMs: MAX_STREAM_CONNECTION_MS,
        });
        streamAbortController.abort();
      }, MAX_STREAM_CONNECTION_MS);

      send("status", {
        status: "connected",
        provider: provider.providerName,
        quality: provider.quality,
        streamMode: provider.streamMode,
        identityMode: parsed.mode,
        symbols: requestSymbols,
        canonicalIds: canonicalPreparation?.status === "ready"
          ? canonicalPreparation.identities.map((identity) => identity.canonicalId)
          : [],
        instruments: canonicalPreparation?.status === "ready" ? canonicalPreparation.identities : [],
        pollIntervalMs: streamIntervalMs,
        heartbeatMs: STREAM_HEARTBEAT_MS,
        maxConnectionMs: MAX_STREAM_CONNECTION_MS,
        note: provider.streamMode === "rest_polling"
          ? "Server streamt normalisierte Quotes; Provider-Verbindung nutzt REST-Polling als Fallback."
          : "Server streamt normalisierte Quotes ohne API-Key im Frontend.",
      });

      heartbeatTimer = setInterval(() => {
        send("heartbeat", {
          timestamp: new Date().toISOString(),
          provider: provider.providerName,
          identityMode: parsed.mode,
          status: "connected",
        });
      }, STREAM_HEARTBEAT_MS);

      try {
        for await (const quotes of provider.streamQuotes(requestSymbols, {
          signal: streamAbortController.signal,
          intervalMs: streamIntervalMs,
        })) {
          const safeQuotes = canonicalPreparation?.status === "ready"
            ? bindQuotesToCanonicalIdentities(quotes, canonicalPreparation.identities)
            : filterLegacyQuotes(quotes, allowedSymbols);

          send("quotes", {
            provider: provider.providerName,
            identityMode: parsed.mode,
            quotes: safeQuotes,
            droppedQuotes: Math.max(0, quotes.length - safeQuotes.length),
            receivedAt: new Date().toISOString(),
          });
          send("heartbeat", {
            timestamp: new Date().toISOString(),
            provider: provider.providerName,
            identityMode: parsed.mode,
          });
        }
      } catch (error) {
        if (request.signal.aborted || lifetimeEnded) {
          logEvent("info", "market.stream_closed", {
            provider: provider.providerName,
            reason: lifetimeEnded ? "max_connection_ms" : "client_abort",
          });
          return;
        }
        logEvent("error", "market.stream_failed", { provider: provider.providerName, error });
        send("error", {
          provider: provider.providerName,
          identityMode: parsed.mode,
          message: "Marktdatenstream unterbrochen. Client soll auf REST-Polling wechseln.",
        });
      } finally {
        closed = true;
        stopHeartbeat();
        stopLifetimeTimer();
        try {
          controller.close();
        } catch {
          // Client may already have disconnected.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...secureStreamHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      [REQUEST_ID_HEADER]: requestId,
      "X-StockPilot-Provider": provider.providerName,
      "X-StockPilot-Stream-Mode": provider.streamMode,
      "X-StockPilot-Identity-Mode": parsed.mode,
      "X-StockPilot-Stream-Interval-Ms": `${streamIntervalMs}`,
      "X-StockPilot-Stream-Max-Connection-Ms": `${MAX_STREAM_CONNECTION_MS}`,
      "X-StockPilot-Instrument-Count": `${requestSymbols.length}`,
    },
  });
}

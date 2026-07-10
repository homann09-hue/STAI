import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { REQUEST_ID_HEADER, jsonError, rateLimit, secureStreamHeaders } from "@/lib/api-guard";
import { getStreamIntervalMs } from "@/lib/cost-controls";
import { logEvent } from "@/lib/observability";
import type { NormalizedQuote } from "@/lib/types";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_STREAM_SYMBOLS = 30;
const MAX_STREAM_SYMBOLS_QUERY_LENGTH = 720;
const MAX_STREAM_QUOTES_PER_EVENT = 30;
const MAX_SSE_PAYLOAD_CHARS = 64_000;
const MAX_STREAM_CONNECTION_MS = 5 * 60_000;
const STREAM_HEARTBEAT_MS = 15_000;

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbols = searchParams.get("symbols") ?? searchParams.get("symbol") ?? "";

  if (rawSymbols.length > MAX_STREAM_SYMBOLS_QUERY_LENGTH) {
    return { ok: false as const, reason: "too_long" as const, symbols: [] };
  }

  const symbols = rawSymbols
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  return { ok: true as const, symbols };
}

function sse(event: string, data: unknown) {
  const payload = JSON.stringify(data);

  if (payload.length > MAX_SSE_PAYLOAD_CHARS) {
    return `event: error\ndata: ${JSON.stringify({
      message: "Stream-Payload wurde aus Sicherheitsgründen begrenzt.",
      maxPayloadChars: MAX_SSE_PAYLOAD_CHARS
    })}\n\n`;
  }

  return `event: ${event}\ndata: ${payload}\n\n`;
}

function filterQuotesForSubscription(quotes: NormalizedQuote[], allowedSymbols: Set<string>) {
  return quotes
    .filter((quote) => typeof quote.symbol === "string" && allowedSymbols.has(quote.symbol.toUpperCase()))
    .slice(0, MAX_STREAM_QUOTES_PER_EVENT);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const parsedSymbols = parseSymbols(request);

  if (!parsedSymbols.ok) {
    return jsonError("Stream-Symbol-Anfrage ist zu lang.", 400);
  }

  if (!parsedSymbols.symbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  if (parsedSymbols.symbols.length > MAX_STREAM_SYMBOLS) {
    return jsonError(`Maximal ${MAX_STREAM_SYMBOLS} Stream-Symbole pro Verbindung.`, 400);
  }

  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const rawSymbol of parsedSymbols.symbols) {
    const parsed = validateSymbol(rawSymbol);
    if (!parsed.success) return jsonError("Ungültiges Symbol.", 400);
    if (!seen.has(parsed.data)) {
      seen.add(parsed.data);
      symbols.push(parsed.data);
    }
  }

  const encoder = new TextEncoder();
  const provider = getMarketDataProvider();
  const requestId = crypto.randomUUID();
  const streamIntervalMs = getStreamIntervalMs(request);
  const allowedSymbols = new Set(symbols.map((symbol) => symbol.toUpperCase()));

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

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          stopHeartbeat();
          stopLifetimeTimer();
          streamAbortController.abort();
        },
        { once: true }
      );

      lifetimeTimer = setTimeout(() => {
        lifetimeEnded = true;
        send("complete", {
          provider: provider.providerName,
          message: "Stream-Laufzeitlimit erreicht. Client soll die Verbindung mit Backoff neu öffnen.",
          maxConnectionMs: MAX_STREAM_CONNECTION_MS
        });
        streamAbortController.abort();
      }, MAX_STREAM_CONNECTION_MS);

      send("status", {
        status: "connected",
        provider: provider.providerName,
        quality: provider.quality,
        streamMode: provider.streamMode,
        symbols,
        pollIntervalMs: streamIntervalMs,
        heartbeatMs: STREAM_HEARTBEAT_MS,
        maxConnectionMs: MAX_STREAM_CONNECTION_MS,
        note:
          provider.streamMode === "rest_polling"
            ? "Server streamt normalisierte Quotes; Provider-Verbindung nutzt REST-Polling als Fallback."
            : "Server streamt normalisierte Quotes ohne API-Key im Frontend."
      });

      heartbeatTimer = setInterval(() => {
        send("heartbeat", {
          timestamp: new Date().toISOString(),
          provider: provider.providerName,
          status: "connected"
        });
      }, STREAM_HEARTBEAT_MS);

      try {
        for await (const quotes of provider.streamQuotes(symbols, {
          signal: streamAbortController.signal,
          intervalMs: streamIntervalMs
        })) {
          const safeQuotes = filterQuotesForSubscription(quotes, allowedSymbols);

          send("quotes", {
            provider: provider.providerName,
            quotes: safeQuotes,
            droppedQuotes: Math.max(0, quotes.length - safeQuotes.length),
            receivedAt: new Date().toISOString()
          });
          send("heartbeat", {
            timestamp: new Date().toISOString(),
            provider: provider.providerName
          });
        }
      } catch (error) {
        if (request.signal.aborted || lifetimeEnded) {
          logEvent("info", "market.stream_closed", {
            provider: provider.providerName,
            reason: lifetimeEnded ? "max_connection_ms" : "client_abort"
          });
          return;
        }

        logEvent("error", "market.stream_failed", { provider: provider.providerName, error });
        send("error", {
          provider: provider.providerName,
          message: "Marktdatenstream unterbrochen. Client soll auf REST-Polling wechseln."
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
    }
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
      "X-StockPilot-Stream-Interval-Ms": `${streamIntervalMs}`,
      "X-StockPilot-Stream-Max-Connection-Ms": `${MAX_STREAM_CONNECTION_MS}`,
      "X-StockPilot-Symbol-Count": `${symbols.length}`
    }
  });
}

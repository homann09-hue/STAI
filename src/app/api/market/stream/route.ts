import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { REQUEST_ID_HEADER, jsonError, rateLimit, secureStreamHeaders } from "@/lib/api-guard";
import { getStreamIntervalMs } from "@/lib/cost-controls";
import { logEvent } from "@/lib/observability";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_STREAM_SYMBOLS = 30;

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("symbols") ?? searchParams.get("symbol") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const rawSymbols = parseSymbols(request);

  if (!rawSymbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  if (rawSymbols.length > MAX_STREAM_SYMBOLS) {
    return jsonError(`Maximal ${MAX_STREAM_SYMBOLS} Stream-Symbole pro Verbindung.`, 400);
  }

  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const rawSymbol of rawSymbols) {
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          stopHeartbeat();
        },
        { once: true }
      );

      send("status", {
        status: "connected",
        provider: provider.providerName,
        quality: provider.quality,
        streamMode: provider.streamMode,
        symbols,
        pollIntervalMs: streamIntervalMs,
        heartbeatMs: 15000,
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
      }, 15000);

      try {
        for await (const quotes of provider.streamQuotes(symbols, {
          signal: request.signal,
          intervalMs: streamIntervalMs
        })) {
          send("quotes", {
            provider: provider.providerName,
            quotes,
            receivedAt: new Date().toISOString()
          });
          send("heartbeat", {
            timestamp: new Date().toISOString(),
            provider: provider.providerName
          });
        }
      } catch (error) {
        logEvent("error", "market.stream_failed", { provider: provider.providerName, error });
        if (!request.signal.aborted) {
          send("error", {
            provider: provider.providerName,
            message: "Marktdatenstream unterbrochen. Client soll auf REST-Polling wechseln."
          });
        }
      } finally {
        closed = true;
        stopHeartbeat();

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
      "X-StockPilot-Symbol-Count": `${symbols.length}`
    }
  });
}

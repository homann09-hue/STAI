import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, rateLimit } from "@/lib/api-guard";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("symbols") ?? searchParams.get("symbol") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const rawSymbols = parseSymbols(request);

  if (!rawSymbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  const symbols: string[] = [];

  for (const rawSymbol of rawSymbols) {
    const parsed = validateSymbol(rawSymbol);
    if (!parsed.success) return jsonError("Ungueltiges Symbol.", 400);
    symbols.push(parsed.data);
  }

  const encoder = new TextEncoder();
  const provider = getMarketDataProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(sse(event, data)));
      }

      send("status", {
        status: "connected",
        provider: provider.providerName,
        quality: provider.quality,
        streamMode: provider.streamMode,
        symbols,
        heartbeatMs: 15000,
        note:
          provider.streamMode === "rest_polling"
            ? "Server streamt normalisierte Quotes; Provider-Verbindung nutzt REST-Polling als Fallback."
            : "Server streamt normalisierte Quotes ohne API-Key im Frontend."
      });

      try {
        for await (const quotes of provider.streamQuotes(symbols, {
          signal: request.signal,
          intervalMs: 5000
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
        console.error("market stream failed", { provider: provider.providerName, error });
        send("error", {
          provider: provider.providerName,
          message: "Marktdatenstream unterbrochen. Client soll auf REST-Polling wechseln."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-StockPilot-Provider": provider.providerName,
      "X-StockPilot-Stream-Mode": provider.streamMode
    }
  });
}

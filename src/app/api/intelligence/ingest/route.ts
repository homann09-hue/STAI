import { FmpNewsAdapter, SecEdgarAdapter } from "@/lib/intelligence/adapters";
import { runIntelligencePipeline } from "@/lib/intelligence/pipeline";
import { intelligenceIngestSchema } from "@/lib/intelligence/schemas";
import { hasPrivilegedAccess } from "@/lib/admin-access";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function configuredRequest() {
  const providers = (process.env.STOCKPILOT_INTELLIGENCE_PROVIDERS ?? "fmp,sec_edgar")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is "fmp" | "sec_edgar" => value === "fmp" || value === "sec_edgar");
  const symbols = (process.env.STOCKPILOT_INTELLIGENCE_SYMBOLS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const secEntities = (process.env.STOCKPILOT_SEC_ENTITIES ?? "")
    .split(",")
    .flatMap((entry) => {
      const [symbol, cik] = entry.split(":").map((value) => value.trim());
      return symbol && cik ? [{ symbol: symbol.toUpperCase(), cik }] : [];
    });
  const limit = Number(process.env.STOCKPILOT_INTELLIGENCE_BATCH_LIMIT ?? 7);
  return intelligenceIngestSchema.safeParse({ providers: providers.length ? providers : ["fmp"], symbols, secEntities, limit });
}

async function ingest(payload: typeof intelligenceIngestSchema._output) {
  const results: Awaited<ReturnType<typeof runIntelligencePipeline>>[] = [];
  const failures: Array<{ provider: string; error: string }> = [];

  for (const provider of payload.providers) {
    try {
      if (provider === "fmp") {
        results.push(await runIntelligencePipeline(new FmpNewsAdapter(), { symbols: payload.symbols, limit: payload.limit }));
      } else {
        results.push(await runIntelligencePipeline(new SecEdgarAdapter(), { secEntities: payload.secEntities, limit: payload.limit }));
      }
    } catch (error) {
      failures.push({
        provider,
        error: error instanceof Error ? error.message.slice(0, 500) : "Provider-Verarbeitung fehlgeschlagen."
      });
    }
  }

  return { results, failures, generatedAt: new Date().toISOString() };
}

function authorize(request: Request) {
  if (hasPrivilegedAccess(request, "intelligence_ingest")) return null;
  return jsonError("Intelligence-Ingestion ist nur für autorisierte Server-Jobs verfügbar.", 401);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;
  const parsed = configuredRequest();
  if (!parsed.success) return jsonError("Intelligence-Umgebungsvariablen sind ungültig.", 503);
  const result = await ingest(parsed.data);
  const status = result.failures.length === parsed.data.providers.length ? 502 : result.failures.length ? 207 : 200;
  return jsonOk(result, { status, headers: { "X-StockPilot-Intelligence": result.failures.length ? "degraded" : "processed" } });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;
  const parsed = await parseJsonBody(request, intelligenceIngestSchema);
  if (!parsed.ok) return parsed.response;
  const result = await ingest(parsed.data);
  const status = result.failures.length === parsed.data.providers.length ? 502 : result.failures.length ? 207 : 200;
  return jsonOk(result, { status, headers: { "X-StockPilot-Intelligence": result.failures.length ? "degraded" : "processed" } });
}

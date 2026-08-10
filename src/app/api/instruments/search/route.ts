import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import {
  instrumentCatalogAssetClasses,
  searchInstrumentCatalog
} from "@/lib/instrument-catalog-service";
import type { MarketUniverseAssetClass } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 64;

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const requestedAssetClass = (searchParams.get("assetClass") ?? "all").trim().toLowerCase();
  const requestedLimit = Number(searchParams.get("limit") ?? 40);

  if (query.length > MAX_QUERY_LENGTH) return jsonError("Suchbegriff ist zu lang.", 400);
  if (query && !/^[\p{L}\p{N}\s._:/^&+\-()]{1,64}$/u.test(query)) {
    return jsonError("Suchbegriff enthaelt ungueltige Zeichen.", 400);
  }
  if (
    requestedAssetClass !== "all" &&
    !instrumentCatalogAssetClasses.includes(requestedAssetClass as MarketUniverseAssetClass)
  ) {
    return jsonError("Ungueltige Assetklasse.", 400);
  }
  if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
    return jsonError("Limit muss eine positive Zahl sein.", 400);
  }

  const result = await searchInstrumentCatalog({
    query,
    assetClass: requestedAssetClass as MarketUniverseAssetClass | "all",
    limit: Math.min(200, Math.floor(requestedLimit))
  });

  return jsonOk(result, {
    headers: {
      "Cache-Control": "no-store",
      "X-StockPilot-Universe-Complete": "false",
      "X-StockPilot-Universe-Mode": "search-driven"
    }
  });
}

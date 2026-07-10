import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { getMarketUniverseProvider } from "@/lib/market-universe";
import type { MarketUniverseAssetClass } from "@/lib/types";

const allowedAssetClasses: Array<MarketUniverseAssetClass | "all"> = [
  "all",
  "stock",
  "etf",
  "crypto",
  "index",
  "forex",
  "commodity",
  "bond",
  "future",
  "option",
  "warrant",
  "fund"
];

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  const requestedAssetClass = searchParams.get("assetClass") ?? "all";

  if (query.length > 80) {
    return jsonError("Suchbegriff ist zu lang.", 400);
  }

  if (query && !/^[\p{L}\p{N}\s._:/&+\-()]{1,80}$/u.test(query)) {
    return jsonError("Suchbegriff enthält ungültige Zeichen.", 400);
  }

  if (!allowedAssetClasses.includes(requestedAssetClass as MarketUniverseAssetClass | "all")) {
    return jsonError("Ungültige Assetklasse.", 400);
  }

  const assetClass = requestedAssetClass as MarketUniverseAssetClass | "all";
  const rawLimit = searchParams.get("limit");
  const requestedLimit = rawLimit === null ? 80 : Number(rawLimit);

  if (!Number.isFinite(requestedLimit) || requestedLimit < 1) {
    return jsonError("Limit muss eine positive Zahl sein.", 400);
  }

  const limit = Math.min(200, Math.floor(requestedLimit));

  const provider = getMarketUniverseProvider();
  const result = await provider.search({ query, assetClass, limit });

  return jsonOk(
    result,
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        "X-StockPilot-Universe": "prepared",
        "X-StockPilot-Universe-Provider": provider.providerName
      }
    }
  );
}

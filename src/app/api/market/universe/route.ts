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
  const query = searchParams.get("q") ?? "";
  const requestedAssetClass = searchParams.get("assetClass") ?? "all";

  if (!allowedAssetClasses.includes(requestedAssetClass as MarketUniverseAssetClass | "all")) {
    return jsonError("Ungültige Assetklasse.", 400);
  }

  const assetClass = requestedAssetClass as MarketUniverseAssetClass | "all";
  const requestedLimit = Number(searchParams.get("limit") ?? 80);
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 80;

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

import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getMarketUniverse, marketUniverseCoverage } from "@/lib/market-universe";
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
  const limited = rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const requestedAssetClass = searchParams.get("assetClass") ?? "all";
  const assetClass = allowedAssetClasses.includes(requestedAssetClass as MarketUniverseAssetClass | "all")
    ? (requestedAssetClass as MarketUniverseAssetClass | "all")
    : "all";
  const limit = Number(searchParams.get("limit") ?? 80);

  return jsonOk(
    {
      instruments: getMarketUniverse({ query, assetClass, limit }),
      coverage: marketUniverseCoverage,
      disclaimer:
        "STAI kann ein globales Marktuniversum strukturieren. Echte Vollabdeckung und Realtime fuer alle Boersen erfordern Anbieterplaene und Boersenlizenzen."
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        "X-StockPilot-Universe": "prepared"
      }
    }
  );
}

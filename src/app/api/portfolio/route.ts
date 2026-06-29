import { getMockPortfolio } from "@/lib/mock/market";
import { jsonOk, parseJsonBody, rateLimit } from "@/lib/api-guard";
import { portfolioTradeInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  return jsonOk(getMockPortfolio(), {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120"
    }
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, portfolioTradeInputSchema);
  if (!parsed.ok) return parsed.response;

  return jsonOk(
    {
      trade: {
        id: `api-${Date.now()}`,
        ...parsed.data
      }
    },
    { status: 201 }
  );
}

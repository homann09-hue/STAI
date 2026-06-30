import { getMockPortfolio } from "@/lib/mock/market";
import { jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { applyUserPortfolioTrade, deleteUserPortfolioPosition, getSupabaseAuth, getUserPortfolio } from "@/lib/supabase/user-data";
import { portfolioDeleteInputSchema, portfolioTradeInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const portfolio = await getUserPortfolio(auth);
    return jsonOk({ ...portfolio, mode: "supabase" }, {
      headers: {
        "Cache-Control": "private, no-store"
      }
    });
  }

  return jsonOk({ ...getMockPortfolio(), mode: "local", reason: auth.reason }, {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, portfolioTradeInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const portfolio = await applyUserPortfolioTrade(auth, parsed.data);
    return jsonOk({ portfolio, mode: "supabase" }, { status: 201 });
  }

  return jsonOk(
    {
      trade: {
        id: `api-${Date.now()}`,
        ...parsed.data
      },
      mode: "local",
      reason: auth.reason
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, portfolioDeleteInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const portfolio = await deleteUserPortfolioPosition(auth, parsed.data.id);
    return jsonOk({ portfolio, mode: "supabase" });
  }

  return jsonOk({ id: parsed.data.id, mode: "local", reason: auth.reason });
}

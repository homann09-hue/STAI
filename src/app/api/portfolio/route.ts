import { getMockPortfolio } from "@/lib/mock/market";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
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

  return jsonError("Anmeldung erforderlich. Portfolio-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
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

  return jsonError("Anmeldung erforderlich. Portfolio-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
}

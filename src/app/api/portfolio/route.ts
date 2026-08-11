import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { analyzePortfolio } from "@/lib/portfolio-analytics";
import {
  applyUserPortfolioTrade,
  deleteUserPortfolioPosition,
  getSupabaseAuth,
  getUserPortfolio,
  PortfolioTradeConflictError
} from "@/lib/supabase/user-data";
import { portfolioDeleteInputSchema, portfolioTradeInputSchema } from "@/lib/validation";

const userDataHeaders = {
  "Cache-Control": "private, no-store"
};

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (auth.ok) {
    const portfolio = await getUserPortfolio(auth);
    return jsonOk({
      ...portfolio,
      mode: "supabase",
      metadata: {
        storage: "supabase",
        dataQuality: "user_data",
        demo: false,
        disclaimer: "Portfolio-Daten sind nutzerbezogen und werden nicht öffentlich gecached."
      }
    }, { headers: userDataHeaders });
  }

  return jsonOk({
    ...analyzePortfolio([]),
    mode: "local",
    reason: auth.reason,
    metadata: {
      storage: "client",
      dataQuality: "user_data",
      demo: false,
      disclaimer: "Keine Anmeldung aktiv. Das lokale Portfolio beginnt leer und enthält ausschließlich vom Nutzer eingegebene oder importierte Positionen."
    }
  }, { headers: userDataHeaders });
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
    try {
      const portfolio = await applyUserPortfolioTrade(auth, parsed.data);
      return jsonOk({ portfolio, mode: "supabase" }, { status: 201, headers: userDataHeaders });
    } catch (error) {
      if (error instanceof PortfolioTradeConflictError) return jsonError(error.message, 409);
      return jsonError("Portfolio-Transaktion konnte nicht sicher gespeichert werden.", 503);
    }
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
    return jsonOk({ portfolio, mode: "supabase" }, { headers: userDataHeaders });
  }

  return jsonError("Anmeldung erforderlich. Portfolio-Änderungen werden nur lokal im Client gespeichert.", 401, {
    "X-StockPilot-Auth-Reason": auth.reason
  });
}

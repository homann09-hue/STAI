import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import {
  addUserWatchlistItem,
  getSupabaseAuth,
  listUserWatchlist,
  removeUserWatchlistItem
} from "@/lib/supabase/user-data";
import { watchlistInputSchema } from "@/lib/validation";

const userDataHeaders = {
  "Cache-Control": "private, no-store"
};

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonOk({
      items: [],
      mode: "local",
      reason: auth.reason,
      metadata: {
        storage: "client",
        dataQuality: "local",
        cloudSync: false,
        disclaimer: "Keine Supabase-Session aktiv. Watchlist-Daten werden nur lokal im Client verwaltet."
      }
    }, { headers: userDataHeaders });
  }

  const items = await listUserWatchlist(auth);
  return jsonOk({
    items,
    mode: "supabase",
    metadata: {
      storage: "supabase",
      dataQuality: "user_data",
      cloudSync: true,
      disclaimer: "Userdaten sind privat und werden nicht als öffentliche Marktdaten gecached."
    }
  }, { headers: userDataHeaders });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, watchlistInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich. Watchlist-Änderungen werden nur lokal im Client gespeichert.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const item = await addUserWatchlistItem(auth, parsed.data.symbol, parsed.data.assetType);
  return jsonOk({ item, mode: "supabase" }, { status: 201, headers: userDataHeaders });
}

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, watchlistInputSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich. Watchlist-Änderungen werden nur lokal im Client gespeichert.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  await removeUserWatchlistItem(auth, parsed.data.symbol);
  return jsonOk({ symbol: parsed.data.symbol, mode: "supabase" }, { headers: userDataHeaders });
}

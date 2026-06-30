import { jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import {
  addUserWatchlistItem,
  getSupabaseAuth,
  listUserWatchlist,
  removeUserWatchlistItem
} from "@/lib/supabase/user-data";
import { watchlistInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonOk({ items: [], mode: "local", reason: auth.reason });
  }

  const items = await listUserWatchlist(auth);
  return jsonOk({ items, mode: "supabase" });
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
    return jsonOk({ item: parsed.data, mode: "local", reason: auth.reason }, { status: 201 });
  }

  const item = await addUserWatchlistItem(auth, parsed.data.symbol, parsed.data.assetType);
  return jsonOk({ item, mode: "supabase" }, { status: 201 });
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
    return jsonOk({ symbol: parsed.data.symbol, mode: "local", reason: auth.reason });
  }

  await removeUserWatchlistItem(auth, parsed.data.symbol);
  return jsonOk({ symbol: parsed.data.symbol, mode: "supabase" });
}

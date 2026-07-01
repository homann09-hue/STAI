import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getSupabaseAuth, listUserPortfolioBooks, createUserPortfolioBook, deleteUserPortfolioBook } from "@/lib/supabase/user-data";

const createBookSchema = z.object({
  name: z.string().trim().min(1).max(80).refine((value) => !/[<>]/.test(value), "Name enthält ungültige Zeichen")
});

const deleteBookSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/, "ID enthält ungültige Zeichen")
});

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonOk({ portfolios: [], mode: "local", reason: auth.reason });

  const portfolios = await listUserPortfolioBooks(auth);
  return jsonOk({ portfolios, mode: "supabase" });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, createBookSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonError("Anmeldung erforderlich. Portfolio bleibt lokal im Client.", 401);

  const portfolio = await createUserPortfolioBook(auth, parsed.data.name);
  return jsonOk({ portfolio, mode: "supabase" }, { status: 201 });
}

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, deleteBookSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonError("Anmeldung erforderlich. Portfolio bleibt lokal im Client.", 401);

  await deleteUserPortfolioBook(auth, parsed.data.id);
  return jsonOk({ ok: true, mode: "supabase" });
}

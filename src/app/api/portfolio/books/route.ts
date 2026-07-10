import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getSupabaseAuth, listUserPortfolioBooks, createUserPortfolioBook, deleteUserPortfolioBook } from "@/lib/supabase/user-data";

function hasUnsafeBookNameChars(value: string) {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return char === "<" || char === ">" || code < 32 || code === 127;
  });
}

const createBookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => !hasUnsafeBookNameChars(value), "Name enthält ungültige Zeichen")
    .transform((value) => value.replace(/\s+/g, " "))
});

const deleteBookSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/, "ID enthält ungültige Zeichen")
});

const userDataHeaders = {
  "Cache-Control": "private, no-store"
};

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonOk({
      portfolios: [],
      mode: "local",
      reason: auth.reason,
      metadata: {
        storage: "client",
        dataQuality: "local",
        cloudSync: false,
        disclaimer: "Keine Supabase-Session aktiv. Portfolio-Books werden nur lokal im Client verwaltet."
      }
    }, { headers: userDataHeaders });
  }

  const portfolios = await listUserPortfolioBooks(auth);
  return jsonOk({
    portfolios,
    mode: "supabase",
    metadata: {
      storage: "supabase",
      dataQuality: "user_data",
      cloudSync: true,
      disclaimer: "Portfolio-Books sind private Userdaten und werden nicht öffentlich gecached."
    }
  }, { headers: userDataHeaders });
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, createBookSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich. Portfolio bleibt lokal im Client.", 401, {
      ...userDataHeaders,
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const portfolio = await createUserPortfolioBook(auth, parsed.data.name);
  return jsonOk({ portfolio, mode: "supabase" }, { status: 201, headers: userDataHeaders });
}

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, deleteBookSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich. Portfolio bleibt lokal im Client.", 401, {
      ...userDataHeaders,
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  await deleteUserPortfolioBook(auth, parsed.data.id);
  return jsonOk({ ok: true, mode: "supabase" }, { headers: userDataHeaders });
}

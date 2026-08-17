import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  jsonError,
  jsonOk,
  parseJsonBody,
  rateLimit,
  requireSameOrigin,
} from "@/lib/api-guard";
import { requireAdmin } from "@/lib/billing/admin-guard";
import { buildAdminAccountsView, type ProfileRow } from "@/lib/billing/admin-accounts";
import { parseManualGrant, planManualGrant } from "@/lib/billing/manual-grant";
import type { EntitlementRow } from "@/lib/billing/entitlements";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konten, Abos und manuelle Freischaltungen.
 *
 * Die Antwort enthält E-Mail-Adressen und Tarife fremder Konten. Sie gehört
 * niemandem außer dem Betreiber, ist deshalb hinter `requireAdmin` und trägt
 * `no-store`: nichts davon darf in einem Zwischenspeicher landen.
 */

const MAX_LISTED = 200;
const MAX_ENTITLEMENT_ROWS = 5_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const manualGrantRequestSchema = z
  .object({
    userId: z.string().regex(uuidPattern),
    plan: z.string().max(32),
    months: z.union([z.number(), z.string().max(4)]).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

const privateHeaders = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return jsonError("Ohne Datenbankanbindung nicht ermittelbar.", 503, privateHeaders);

  const search = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";

  let profileQuery = supabase
    .from("profiles")
    .select("id,email,display_name,created_at,is_admin", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(MAX_LISTED);

  if (search.length > 0) {
    // Nur Gleichheit auf dem gereinigten Text: `%` und `_` in einer
    // ilike-Bedingung waeren sonst vom Aufrufer gestellte Suchmuster.
    profileQuery = profileQuery.ilike("email", `%${search.replace(/[%_\\]/g, "")}%`);
  }

  const [profiles, entitlements] = await Promise.all([
    profileQuery,
    supabase
      .from("entitlements")
      .select(
        "user_id,plan,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,valid_until,trial_ends_at,cancel_at_period_end,last_synced_at,features,updated_at"
      )
      .limit(MAX_ENTITLEMENT_ROWS)
  ]);

  if (profiles.error || entitlements.error) {
    logEvent("error", "admin.accounts_read_failed", {
      profiles: profiles.error?.code ?? null,
      entitlements: entitlements.error?.code ?? null
    });
    return jsonError("Die Kontenliste ist gerade nicht abrufbar.", 503, privateHeaders);
  }

  const view = buildAdminAccountsView({
    profiles: (profiles.data ?? []) as ProfileRow[],
    entitlements: (entitlements.data ?? []) as EntitlementRow[],
    totalAccounts: profiles.count ?? (profiles.data ?? []).length
  });

  return jsonOk(
    {
      ...view,
      // Ehrlich benennen, wenn die Liste gekuerzt ist: eine Tabelle, die
      // stillschweigend bei 200 aufhoert, laesst den Betreiber glauben, er
      // sehe alle Konten.
      listTruncated: view.totalAccounts > view.accounts.length
    },
    { headers: privateHeaders }
  );
}

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const supabase = createSupabaseServiceClient();
  if (!supabase) return jsonError("Ohne Datenbankanbindung nicht änderbar.", 503, privateHeaders);

  const parsedBody = await parseJsonBody(request, manualGrantRequestSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!uuidPattern.test(userId)) return jsonError("Es fehlt ein gültiges Konto.", 400, privateHeaders);

  const grant = parseManualGrant({ plan: body.plan, months: body.months, reason: body.reason });
  if (!grant.ok) return jsonError(grant.message, 400, privateHeaders);

  const { data: existing, error: readError } = await supabase
    .from("entitlements")
    .select("plan,status,provider,valid_until,updated_at")
    .eq("user_id", userId)
    .limit(20);

  if (readError) {
    logEvent("error", "admin.grant_read_failed", { code: readError.code });
    return jsonError("Der bestehende Tarif ließ sich nicht lesen — es wurde nichts geändert.", 503, privateHeaders);
  }

  const outcome = planManualGrant(grant, (existing ?? []) as EntitlementRow[]);

  const { error: writeError } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      provider: "manual",
      plan: outcome.row.plan,
      status: outcome.row.status,
      valid_until: outcome.row.valid_until,
      last_synced_at: new Date().toISOString()
    },
    { onConflict: "user_id,provider" }
  );

  if (writeError) {
    logEvent("error", "admin.grant_write_failed", { code: writeError.code, message: writeError.message });
    return jsonError("Die Änderung wurde nicht gespeichert.", 503, privateHeaders);
  }

  // Protokoll in derselben Tabelle wie die Stripe-Ereignisse: die
  // Abo-Geschichte eines Kontos gehoert an **eine** Stelle, sonst laesst sich
  // im Streitfall nicht rekonstruieren, was wann galt.
  const eventId = randomUUID();
  const { error: logError } = await supabase.from("billing_events").insert({
    provider: "manual",
    event_id: eventId,
    event_type: outcome.row.plan === "free" ? "admin.plan_revoked" : "admin.plan_granted",
    status: "processed",
    user_id: userId,
    payload_hash: createHash("sha256")
      .update(JSON.stringify({ eventId, userId, plan: outcome.row.plan, reason: grant.reason, actor: admin.userId }))
      .digest("hex"),
    livemode: true,
    provider_created_at: new Date().toISOString()
  });

  if (logError) {
    // Die Aenderung steht, das Protokoll nicht. Das gehoert benannt und nicht
    // als Erfolg verkauft -- eine Tarifaenderung ohne Spur ist genau das, was
    // eine Pruefung beanstandet.
    logEvent("error", "admin.grant_audit_failed", { code: logError.code, message: logError.message });
  }

  logEvent("info", "admin.plan_changed", {
    actorUserId: admin.userId,
    targetUserId: userId,
    plan: outcome.row.plan,
    months: grant.months
  });

  return jsonOk(
    {
      plan: outcome.row.plan,
      validUntil: outcome.row.valid_until,
      stripeSubscriptionRemains: outcome.stripeSubscriptionRemains,
      message: outcome.message,
      audited: !logError
    },
    { headers: privateHeaders }
  );
}

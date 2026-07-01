import { billingGateStatus, pricingTiers } from "@/lib/feature-gates";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonOk({
      mode: "local",
      billingActive: false,
      plan: "free",
      status: "demo",
      reason: auth.reason,
      tiers: pricingTiers,
      gate: billingGateStatus
    });
  }

  const { data, error } = await auth.supabase
    .from("entitlements")
    .select("plan,status,provider,valid_until,features")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return jsonOk({
    mode: "supabase",
    billingActive: Boolean(data && data.status === "active"),
    plan: data?.plan ?? "free",
    status: data?.status ?? "demo",
    provider: data?.provider ?? "none",
    validUntil: data?.valid_until ?? null,
    features: data?.features ?? {},
    error: error ? "Entitlements konnten nicht gelesen werden." : null,
    tiers: pricingTiers,
    gate: billingGateStatus
  });
}

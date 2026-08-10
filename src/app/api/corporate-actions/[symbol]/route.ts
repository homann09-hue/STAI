import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { persistCorporateActions } from "@/lib/corporate-action-store";
import { fetchCorporateActions } from "@/lib/providers/corporate-actions-provider";
import { findInstrumentIdentityBySymbol } from "@/lib/instrument-master-store";
import { validateSymbol } from "@/lib/validation";

type RouteContext = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const parsed = validateSymbol((await params).symbol);
  if (!parsed.success) return jsonError("Ungültiges Symbol.", 400);

  const known = await findInstrumentIdentityBySymbol(parsed.data);
  const result = await fetchCorporateActions(parsed.data, new Date(), known?.assetClass);
  await persistCorporateActions(result.actions);

  return jsonOk(result, {
    headers: result.available
      ? { "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400" }
      : { "Cache-Control": "no-store" }
  });
}

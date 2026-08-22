import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { persistCorporateActions } from "@/lib/corporate-action-store";
import { fetchCorporateActions } from "@/lib/providers/corporate-actions-provider";
import { resolveInstrumentIdentityBySymbol } from "@/lib/instrument-master-store";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";
import { validateSymbol } from "@/lib/validation";

type RouteContext = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const parsed = validateSymbol((await params).symbol);
  if (!parsed.success) return jsonError("Ungültiges Symbol.", 400);

  const requestedCanonicalId = new URL(request.url).searchParams.get("canonicalId")?.trim() || null;
  if (requestedCanonicalId && !isCanonicalInstrumentId(requestedCanonicalId)) {
    return jsonError("Ungültige Instrument-ID.", 400);
  }
  const identityResolution = await resolveInstrumentIdentityBySymbol(
    parsed.data,
    requestedCanonicalId,
  );
  if (identityResolution.status === "ambiguous") {
    return Response.json(
      {
        error: "Das Symbol bezeichnet mehrere Listings. Bitte Handelsplatz und Währung auswählen.",
        reason: "listing_ambiguous",
        listings: identityResolution.candidates,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (requestedCanonicalId && identityResolution.status !== "resolved") {
    return jsonError("Das gewählte Listing ist nicht mehr eindeutig verfügbar.", 409);
  }
  const known = identityResolution.status === "resolved" ? identityResolution.identity : null;
  const result = await fetchCorporateActions(parsed.data, new Date(), known?.assetClass);
  await persistCorporateActions(result.actions);

  return jsonOk(result, {
    headers: result.available
      ? { "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400" }
      : { "Cache-Control": "no-store" }
  });
}

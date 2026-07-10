import { jsonOk, rateLimit } from "@/lib/api-guard";
import { institutionalReadiness } from "@/lib/institutional/readiness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  return jsonOk({
    ...institutionalReadiness,
    generatedAt: new Date().toISOString(),
    disclaimer: "Readiness ist eine technische Selbsteinschätzung, keine Zertifizierung, Rechtsberatung oder Garantie."
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
  });
}

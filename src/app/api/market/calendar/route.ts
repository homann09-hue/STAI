import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { fetchExchangeCalendar } from "@/lib/providers/exchange-calendar-provider";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const exchange = new URL(request.url).searchParams.get("exchange")?.trim().toUpperCase() || "NASDAQ";
  if (!/^[A-Z0-9._:-]{1,24}$/.test(exchange)) return jsonError("Ungültiger Börsencode.", 400);

  const result = await fetchExchangeCalendar(exchange);
  return jsonOk(result, {
    headers: result.available
      ? { "Cache-Control": "public, max-age=60, s-maxage=21600, stale-while-revalidate=43200" }
      : { "Cache-Control": "no-store" }
  });
}

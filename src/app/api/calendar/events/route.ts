import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { listCorporateActionsByDateRange } from "@/lib/corporate-action-store";

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const today = new Date();
  const from = validDate(url.searchParams.get("from")) ?? addDays(today, -30);
  const to = validDate(url.searchParams.get("to")) ?? addDays(today, 365);
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  if (toMs < fromMs || toMs - fromMs > 366 * 24 * 60 * 60 * 1_000) {
    return jsonError("Zeitraum muss aufsteigend und höchstens 366 Tage lang sein.", 400);
  }

  const result = await listCorporateActionsByDateRange(from, to);
  return jsonOk({ ...result, range: { from, to } }, {
    headers: result.available
      ? { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" }
      : { "Cache-Control": "no-store" }
  });
}

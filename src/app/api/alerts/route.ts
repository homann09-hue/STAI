import { mockAlerts } from "@/lib/mock/market";
import { jsonOk, parseJsonBody, rateLimit } from "@/lib/api-guard";
import { alertInputSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  return jsonOk({ alerts: mockAlerts });
}

export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, alertInputSchema);
  if (!parsed.ok) return parsed.response;

  return jsonOk(
    {
      alert: {
        id: `api-${Date.now()}`,
        ...parsed.data
      }
    },
    { status: 201 }
  );
}

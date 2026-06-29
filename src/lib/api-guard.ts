import { z } from "zod";
import { sanitizeError } from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const buckets = new Map<string, { count: number; resetAt: number }>();

export const secureJsonHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store"
};

function mergeHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);

  for (const [key, value] of Object.entries(secureJsonHeaders)) {
    if (!merged.has(key)) merged.set(key, value);
  }

  return merged;
}

export function rateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const current = buckets.get(clientKey);

  if (!current || current.resetAt <= now) {
    buckets.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  current.count += 1;

  if (current.count > RATE_LIMIT_MAX) {
    return jsonError("Rate Limit erreicht. Bitte kurz warten.", 429, {
      "Retry-After": `${Math.ceil((current.resetAt - now) / 1000)}`
    });
  }

  return null;
}

export function jsonOk<T>(data: T, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: mergeHeaders(init.headers)
  });
}

export function jsonError(message: string, status = 400, headers: HeadersInit = {}) {
  return Response.json(
    {
      error: message,
      requestId: crypto.randomUUID()
    },
    {
      status,
      headers: mergeHeaders(headers)
    }
  );
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodSchema<T>) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return {
        ok: false as const,
        response: jsonError(sanitizeError(parsed.error), 400)
      };
    }

    return {
      ok: true as const,
      data: parsed.data
    };
  } catch {
    return {
      ok: false as const,
      response: jsonError("Ungültiger JSON-Body.", 400)
    };
  }
}

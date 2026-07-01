import { z } from "zod";
import { getServerCacheAdapter } from "@/lib/server-cache";
import { sanitizeError } from "@/lib/validation";
import { logEvent } from "@/lib/observability";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_READ_MAX = 600;
const RATE_LIMIT_MUTATION_MAX = 120;
const MAX_JSON_BODY_BYTES = 32_768;
const buckets = new Map<string, { count: number; resetAt: number }>();
const rateLimitCache = getServerCacheAdapter();
export const REQUEST_ID_HEADER = "X-StockPilot-Request-Id";

export const secureJsonHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
};

export const secureStreamHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store, no-transform",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow"
};

function mergeHeaders(headers?: HeadersInit, requestId = crypto.randomUUID()) {
  const merged = new Headers(headers);

  for (const [key, value] of Object.entries(secureJsonHeaders)) {
    if (!merged.has(key)) merged.set(key, value);
  }

  if (!merged.has(REQUEST_ID_HEADER)) merged.set(REQUEST_ID_HEADER, requestId);

  return merged;
}

export async function rateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || request.headers.get("x-real-ip") || "local";
  const method = request.method.toUpperCase();
  const limitClass = method === "GET" || method === "HEAD" ? "read" : "mutation";
  const maxRequests = limitClass === "read" ? RATE_LIMIT_READ_MAX : RATE_LIMIT_MUTATION_MAX;
  const bucketKey = `${clientKey}:${limitClass}`;
  const now = Date.now();

  if (rateLimitCache.mode === "upstash_rest") {
    const resetAt = Math.ceil(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const cacheKey = `rate-limit:${bucketKey}:${resetAt}`;
    const count = await rateLimitCache.increment(cacheKey, Math.max(1000, resetAt - now));

    if (count > maxRequests) {
      logEvent("warn", "api.rate_limited", {
        clientKey,
        cacheMode: rateLimitCache.mode,
        method,
        limitClass,
        maxRequests,
        resetAt: new Date(resetAt).toISOString()
      });
      return jsonError("Rate Limit erreicht. Bitte kurz warten.", 429, {
        "Retry-After": `${Math.ceil((resetAt - now) / 1000)}`
      });
    }

    return null;
  }

  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  current.count += 1;

  if (current.count > maxRequests) {
    logEvent("warn", "api.rate_limited", {
      clientKey,
      cacheMode: rateLimitCache.mode,
      method,
      limitClass,
      maxRequests,
      resetAt: new Date(current.resetAt).toISOString()
    });
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
  const requestId = crypto.randomUUID();

  if (status >= 500) {
    logEvent("error", "api.error_response", { status, message, requestId });
  } else if (status === 429) {
    logEvent("warn", "api.rate_limit_response", { status, requestId });
  }

  return Response.json(
    {
      error: message,
      requestId
    },
    {
      status,
      headers: mergeHeaders(headers, requestId)
    }
  );
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) return null;

  if (origin !== new URL(request.url).origin) {
    return jsonError("Cross-Origin Request abgelehnt.", 403);
  }

  return null;
}

async function readLimitedText(request: Request, maxBytes: number) {
  if (!request.body) return { ok: true as const, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return { ok: false as const };
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { ok: true as const, text };
  } finally {
    reader.releaseLock();
  }
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodSchema<T>) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false as const,
      response: jsonError("Content-Type muss application/json sein.", 415)
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false as const,
      response: jsonError("JSON-Body ist zu gross.", 413)
    };
  }

  try {
    const limitedBody = await readLimitedText(request, MAX_JSON_BODY_BYTES);

    if (!limitedBody.ok) {
      return {
        ok: false as const,
        response: jsonError("JSON-Body ist zu gross.", 413)
      };
    }

    const body = JSON.parse(limitedBody.text);
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

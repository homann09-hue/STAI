import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  REQUEST_ID_HEADER,
  jsonError,
  jsonOk,
  parseJsonBody,
  rateLimit,
  requireSameOrigin
} from "./api-guard";

describe("api guard observability headers", () => {
  it("adds a request id header to successful JSON responses", async () => {
    const response = jsonOk({ ok: true });

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/[0-9a-f-]{36}/);
  });

  it("keeps error response request id aligned with the header", async () => {
    const response = jsonError("Kaputt", 400);
    const body = await response.json();

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.requestId);
    expect(body.error).toBe("Kaputt");
  });

  it("validates JSON bodies and reports malformed requests safely", async () => {
    const schema = z.object({ symbol: z.string().min(1) });
    const valid = await parseJsonBody(
      new Request("https://stockpilot.test/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "AAPL" })
      }),
      schema
    );

    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.data.symbol).toBe("AAPL");

    const missingContentType = await parseJsonBody(
      new Request("https://stockpilot.test/api/watchlist", { method: "POST", body: "{}" }),
      schema
    );
    expect(missingContentType.ok).toBe(false);
    if (!missingContentType.ok) expect(missingContentType.response.status).toBe(415);

    const tooLarge = await parseJsonBody(
      new Request("https://stockpilot.test/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "32769" },
        body: "{}"
      }),
      schema
    );
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.response.status).toBe(413);

    const invalidJson = await parseJsonBody(
      new Request("https://stockpilot.test/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      }),
      schema
    );
    expect(invalidJson.ok).toBe(false);
    if (!invalidJson.ok) expect(invalidJson.response.status).toBe(400);

    const invalidSchema = await parseJsonBody(
      new Request("https://stockpilot.test/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: "" })
      }),
      schema
    );
    expect(invalidSchema.ok).toBe(false);
    if (!invalidSchema.ok) expect(invalidSchema.response.status).toBe(400);
  });

  it("guards cross-origin writes and rate limits noisy clients", async () => {
    expect(requireSameOrigin(new Request("https://stockpilot.test/api/watchlist"))).toBeNull();
    expect(
      requireSameOrigin(
        new Request("https://stockpilot.test/api/watchlist", {
          headers: { origin: "https://stockpilot.test" }
        })
      )
    ).toBeNull();

    const rejectedOrigin = requireSameOrigin(
      new Request("https://stockpilot.test/api/watchlist", {
        headers: { origin: "https://evil.test" }
      })
    );
    expect(rejectedOrigin?.status).toBe(403);

    const clientKey = `198.51.100.${Math.floor(Math.random() * 1000)}`;
    let limited: Response | null = null;

    for (let index = 0; index < 601; index += 1) {
      limited = await rateLimit(
        new Request("https://stockpilot.test/api/market/quotes", {
          headers: { "x-forwarded-for": clientKey }
        })
      );
    }

    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
  });
});

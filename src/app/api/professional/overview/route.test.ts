import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEntitlements } from "@/lib/billing/entitlements";

/**
 * Regressionstest für eine Lücke, die es in Produktion gab: `/api/professional/overview`
 * prüfte nur das Rate Limit. Der Profi-Terminal-Inhalt ging damit an jeden
 * Aufrufer, auch ohne Konto. Ein Tarif, dessen Leistung anonym erreichbar ist,
 * lässt sich nicht verkaufen.
 *
 * Der Test prüft deshalb nicht nur den Statuscode, sondern auch, dass in einer
 * abgelehnten Antwort tatsächlich keine Bezahldaten stehen.
 */

const PAID_MARKER = "nur-fuer-zahlende-konten";

const getSupabaseAuth = vi.fn();
const getUserEntitlements = vi.fn();

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: (request: Request) => getSupabaseAuth(request)
}));

vi.mock("@/lib/billing/server", () => ({
  getUserEntitlements: (auth: unknown) => getUserEntitlements(auth)
}));

vi.mock("@/lib/providers/professional-data-provider", () => ({
  getProfessionalDataProvider: () => ({
    getMarketReport: async () => ({ headline: PAID_MARKER, sections: [] })
  })
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeBillingConfiguration: () => ({
    plans: { starter: true, pro: true, elite: false }
  })
}));

const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();

function authenticated() {
  return { ok: true, userId: "11111111-1111-4111-8111-111111111111", email: "a@b.test" };
}

function request() {
  // Eigene Client-Kennung je Aufruf, damit das Rate Limit nicht die
  // Berechtigungsprüfung überdeckt.
  return new Request("https://stockpilot.test/api/professional/overview", {
    headers: { "x-real-ip": `10.0.0.${Math.floor(Math.random() * 250) + 1}` }
  });
}

async function callRoute() {
  const { GET } = await import("./route");
  const response = await GET(request());
  const body = await response.text();
  return { response, body, json: JSON.parse(body) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("GET /api/professional/overview", () => {
  it("liefert ohne Konto keine Bezahldaten aus", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: false, reason: "anonymous" });

    const { response, body, json } = await callRoute();

    expect(response.status).toBe(401);
    expect(body).not.toContain(PAID_MARKER);
    expect((json.paywall as Record<string, unknown>).reason).toBe("authentication_required");
  });

  it("weist ein Free-Konto mit Tarifhinweis ab statt mit einem nackten Fehler", async () => {
    getSupabaseAuth.mockResolvedValue(authenticated());
    getUserEntitlements.mockResolvedValue(
      resolveEntitlements({ plan: "free", status: "demo", provider: "none" }, { billingConfigured: true })
    );

    const { response, body, json } = await callRoute();

    expect(response.status).toBe(402);
    expect(body).not.toContain(PAID_MARKER);
    const paywall = json.paywall as Record<string, unknown>;
    expect(paywall.reason).toBe("plan_upgrade_required");
    expect(paywall.requiredPlan).toBe("pro");
    expect(paywall.upgradePath).toBe("/pricing");
    expect(response.headers.get("X-StockPilot-Paywall")).toBe("plan_upgrade_required");
  });

  it("gibt bei nicht konfiguriertem Supabase nichts frei", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: false, reason: "missing_client" });

    const { response, body, json } = await callRoute();

    // Fail closed: ein unfertiges Deployment darf kein Gratistarif sein.
    expect(response.status).toBe(503);
    expect(body).not.toContain(PAID_MARKER);
    expect((json.paywall as Record<string, unknown>).reason).toBe("billing_unverifiable");
  });

  it("liefert dem Pro-Konto die Daten", async () => {
    getSupabaseAuth.mockResolvedValue(authenticated());
    getUserEntitlements.mockResolvedValue(
      resolveEntitlements(
        {
          plan: "pro",
          status: "active",
          provider: "stripe",
          provider_customer_id: "cus_00000000000000",
          valid_until: inOneMonth
        },
        { billingConfigured: true }
      )
    );

    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body).toContain(PAID_MARKER);
  });

  it("legt Bezahlinhalte nicht in einen geteilten Cache", async () => {
    getSupabaseAuth.mockResolvedValue(authenticated());
    getUserEntitlements.mockResolvedValue(
      resolveEntitlements(
        {
          plan: "pro",
          status: "active",
          provider: "stripe",
          provider_customer_id: "cus_00000000000000",
          valid_until: inOneMonth
        },
        { billingConfigured: true }
      )
    );

    const { response } = await callRoute();

    // Ohne diese Zusicherung würde das CDN die Antwort eines berechtigten
    // Kontos an alle weiteren Aufrufer ausliefern — die Prüfung wäre wirkungslos.
    for (const header of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
      expect(response.headers.get(header) ?? "").not.toMatch(/s-maxage|public/);
    }
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

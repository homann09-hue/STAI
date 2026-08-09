import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEntitlements } from "@/lib/billing/entitlements";

/**
 * Regressionstest für die empfindlichste Stelle der Anwendung.
 *
 * Rechnungen sind der einzige Ort, an dem Geld und personenbezogene Daten
 * zusammenkommen. Die Kundennummer, mit der Stripe abgefragt wird, darf
 * ausschließlich aus den serverseitig gelesenen Entitlements stammen — niemals
 * aus der Anfrage. Käme sie von dort, könnte ein Aufrufer die Rechnungen eines
 * fremden Kontos anfordern.
 *
 * Der Test prüft das direkt: er schmuggelt eine fremde Kundennummer über Query
 * und Header ein und stellt sicher, dass Stripe trotzdem mit der eigenen
 * abgefragt wird.
 */

const OWN_CUSTOMER = "cus_00000000000000";
const FOREIGN_CUSTOMER = "cus_99999999999999";

const getSupabaseAuth = vi.fn();
const getUserEntitlements = vi.fn();
const invoicesList = vi.fn();
const customersRetrieve = vi.fn();

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: (request: Request) => getSupabaseAuth(request)
}));

vi.mock("@/lib/billing/server", () => ({
  getUserEntitlements: (auth: unknown) => getUserEntitlements(auth)
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => ({
    invoices: { list: invoicesList },
    customers: { retrieve: customersRetrieve }
  })
}));

const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();

function paidEntitlements() {
  return resolveEntitlements(
    {
      plan: "pro",
      status: "active",
      provider: "stripe",
      provider_customer_id: OWN_CUSTOMER,
      valid_until: inOneMonth
    },
    { billingConfigured: true }
  );
}

function request(url = "https://stockpilot.test/api/billing/invoices") {
  return new Request(url, {
    headers: { "x-real-ip": `10.1.0.${Math.floor(Math.random() * 250) + 1}` }
  });
}

async function callRoute(input?: Request) {
  const { GET } = await import("./route");
  const response = await GET(input ?? request());
  return { response, json: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  invoicesList.mockResolvedValue({ data: [], has_more: false });
  customersRetrieve.mockResolvedValue({ invoice_settings: { default_payment_method: null } });
});

describe("GET /api/billing/invoices", () => {
  it("liefert ohne Konto keine Rechnungen", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: false, reason: "anonymous" });

    const { response } = await callRoute();

    expect(response.status).toBe(401);
    expect(invoicesList).not.toHaveBeenCalled();
  });

  it("fragt Stripe nur mit der eigenen Kundennummer ab", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" });
    getUserEntitlements.mockResolvedValue(paidEntitlements());

    // Eine fremde Kundennummer über die Anfrage eingeschmuggelt. Sie darf
    // nirgends ankommen.
    await callRoute(request(`https://stockpilot.test/api/billing/invoices?customer=${FOREIGN_CUSTOMER}`));

    expect(invoicesList).toHaveBeenCalledTimes(1);
    const passed = invoicesList.mock.calls[0][0] as { customer: string };
    expect(passed.customer).toBe(OWN_CUSTOMER);
    expect(passed.customer).not.toBe(FOREIGN_CUSTOMER);

    const customerCall = customersRetrieve.mock.calls[0][0] as string;
    expect(customerCall).toBe(OWN_CUSTOMER);
  });

  it("behandelt ein Konto ohne Zahlung nicht als Fehler", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" });
    getUserEntitlements.mockResolvedValue(
      resolveEntitlements({ plan: "free", status: "demo", provider: "none" }, { billingConfigured: true })
    );

    const { response, json } = await callRoute();

    expect(response.status).toBe(200);
    expect(json.hasCustomer).toBe(false);
    expect(json.invoices).toEqual([]);
    // Es gab nie eine Zahlung -- das ist kein Fehler und wird auch nicht als
    // solcher dargestellt.
    expect(String(json.note)).toMatch(/keine Zahlung/i);
    expect(invoicesList).not.toHaveBeenCalled();
  });

  it("gibt bei unlesbarem Abrechnungsstatus nichts preis", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" });
    getUserEntitlements.mockResolvedValue(
      resolveEntitlements(null, { billingConfigured: true, degraded: true, reason: "entitlements_unavailable" })
    );

    const { response } = await callRoute();

    expect(response.status).toBe(503);
    expect(invoicesList).not.toHaveBeenCalled();
  });

  it("legt Abrechnungsdaten nicht in einen geteilten Cache", async () => {
    getSupabaseAuth.mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111" });
    getUserEntitlements.mockResolvedValue(paidEntitlements());

    const { response } = await callRoute();

    expect(response.headers.get("Cache-Control")).toContain("no-store");
    for (const header of ["CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
      expect(response.headers.get(header) ?? "").not.toMatch(/s-maxage|public/);
    }
  });
});

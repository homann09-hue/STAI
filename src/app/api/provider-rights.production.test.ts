import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-guard")>();
  return {
    ...actual,
    rateLimit: vi.fn(async () => null),
  };
});

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  process.env.VERCEL_ENV = "production";
  process.env.SEC_CONTACT_EMAIL = "team@example.com";
  delete process.env.MARKET_DATA_ALLOW_EXTERNAL_DISPLAY;
  delete process.env.MARKET_DATA_LICENSE_VERIFIED_PROVIDERS;
  delete process.env.MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

describe("Providerrechte in Produktionsrouten", () => {
  it("meldet gesperrte SEC-Daten nicht als unbekanntes Symbol", async () => {
    const { GET } = await import("@/app/api/sec/filings/route");
    const response = await GET(
      new Request("https://stockpilot.test/api/sec/filings?symbol=AAPL"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).toContain("nicht freigeschaltet");
    expect(JSON.stringify(body)).not.toContain("kein Eintrag im SEC-Register");
  });

  it("nennt bei gesperrten Makrodaten keinen aktiven Provider", async () => {
    const { GET } = await import("@/app/api/macro/route");
    const response = await GET(
      new Request("https://stockpilot.test/api/macro?region=euro_area"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).toContain("nicht freigeschaltet");
    expect(JSON.stringify(body)).not.toContain("ECB Data Portal");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStripeBillingConfiguration, getTrustedBillingOrigin } from "./stripe";

const TEST_SECRET = "sk_test_1234567890abcdef";
const WEBHOOK_SECRET = "whsec_1234567890abcdef";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("STRIPE_SECRET_KEY", TEST_SECRET);
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_12345678");
  vi.stubEnv("STOCKPILOT_ALLOW_TEST_FIXTURES", "false");
  vi.stubEnv("STOCKPILOT_APP_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe secret key boundary", () => {
  it.each([
    "sk_test_1234567890abcdef",
    "sk_live_1234567890abcdef",
    "rk_test_1234567890abcdef",
    "rk_live_1234567890abcdef"
  ])("accepts supported Stripe server key %s", (secretKey) => {
    vi.stubEnv("STRIPE_SECRET_KEY", secretKey);

    expect(getStripeBillingConfiguration().secretKey).toBe(secretKey);
  });

  it("accepts a temporary claimable-sandbox key only in the explicit fixture harness", () => {
    const secretKey = "rkcs_test_1234567890abcdef";
    vi.stubEnv("STRIPE_SECRET_KEY", secretKey);

    expect(getStripeBillingConfiguration().secretKey).toBeNull();

    vi.stubEnv("STOCKPILOT_ALLOW_TEST_FIXTURES", "true");
    expect(getStripeBillingConfiguration().secretKey).toBe(secretKey);
  });

  it.each(["rkcs_live_1234567890abcdef", "pk_test_1234567890abcdef", "rkcs_test_short"])(
    "rejects unsupported key %s even in the fixture harness",
    (secretKey) => {
      vi.stubEnv("STOCKPILOT_ALLOW_TEST_FIXTURES", "true");
      vi.stubEnv("STRIPE_SECRET_KEY", secretKey);

      expect(getStripeBillingConfiguration().secretKey).toBeNull();
    }
  );
});

describe("Stripe billing origin boundary", () => {
  const request = new Request("https://fallback.stockpilot.test/api/billing/checkout");

  it("allows loopback HTTP only in development or the explicit fixture harness", () => {
    vi.stubEnv("STOCKPILOT_APP_URL", "http://127.0.0.1:3012");

    expect(getTrustedBillingOrigin(request)).toBe("https://fallback.stockpilot.test");

    vi.stubEnv("STOCKPILOT_ALLOW_TEST_FIXTURES", "true");
    expect(getTrustedBillingOrigin(request)).toBe("http://127.0.0.1:3012");
  });

  it.each([
    "http://attacker.example",
    "http://127.0.0.1.attacker.example:3012",
    "http://user:password@127.0.0.1:3012"
  ])("rejects unsafe configured origin %s", (origin) => {
    vi.stubEnv("STOCKPILOT_ALLOW_TEST_FIXTURES", "true");
    vi.stubEnv("STOCKPILOT_APP_URL", origin);

    expect(getTrustedBillingOrigin(request)).toBe("https://fallback.stockpilot.test");
  });
});

import { expect, test } from "@playwright/test";

test("billing remains fail-closed without provider configuration", async ({ page, request }) => {
  await page.goto("/pricing");

  await expect(page.getByRole("heading", { name: "Tarife mit verifiziertem Zugriffsstatus." })).toBeVisible();
  await expect(page.getByText("Billing sicher deaktiviert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout nicht konfiguriert" }).first()).toBeDisabled();

  const entitlementResponse = await request.get("/api/billing/entitlements");
  expect(entitlementResponse.status()).toBe(200);
  const entitlement = await entitlementResponse.json();
  expect(entitlement.plan).toBe("free");
  expect(entitlement.billingActive).toBe(false);
  expect(entitlement.billing.configured).toBe(false);

  const checkoutResponse = await request.post("/api/billing/checkout", {
    data: { plan: "pro" },
    headers: { Origin: "http://localhost:3011" }
  });
  expect(checkoutResponse.status()).toBe(401);
});

import { expect, test } from "@playwright/test";

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
}

test("dashboard exposes market, data quality and disclaimer", async ({ page }) => {
  await page.goto("/");
  await acceptRiskNotice(page);

  await expect(page.getByRole("link", { name: /StockPilot AI/ })).toBeVisible();
  await expect(page.getByText("Datenqualität", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();
});

test("asset detail exposes professional risk controls", async ({ page }) => {
  await page.goto("/assets/NVDA");
  await acceptRiskNotice(page);

  await expect(page.getByText("Risiko-Engine")).toBeVisible();
  await expect(page.getByText("Multi-Layer-Analyse")).toBeVisible();
  await expect(page.getByText("Transparentes Score-Modell")).toBeVisible();
  await expect(page.getByText("Modellbasierte Wahrscheinlichkeiten")).toBeVisible();
});

test("portfolio supports trade workflow surface", async ({ page }) => {
  await page.goto("/portfolio");
  await acceptRiskNotice(page);

  await expect(page.getByText("Transaktion eintragen")).toBeVisible();
  await expect(page.getByText("Szenarioanalyse")).toBeVisible();
  await expect(page.getByText("Portfolio-Warnungen")).toBeVisible();
});

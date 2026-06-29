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
  await expect(page.getByText("Capital Command Center").first()).toBeVisible();
  await expect(page.getByText("Smart Sizing nach Score und Risiko").first()).toBeVisible();
  await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();
});

test("asset detail exposes professional risk controls", async ({ page }) => {
  await page.goto("/assets/NVDA");
  await acceptRiskNotice(page);

  await expect(page.getByText("Risiko-Engine")).toBeVisible();
  await expect(page.getByText("Multi-Layer-Analyse")).toBeVisible();
  await expect(page.getByText("Transparentes Score-Modell")).toBeVisible();
  await expect(page.getByText("Modellbasierte Wahrscheinlichkeiten")).toBeVisible();
  await expect(page.getByText("Handlungseinordnung")).toBeVisible();
  await expect(page.getByText("KI Analysekarte")).toBeVisible();
});

test("portfolio supports trade workflow surface", async ({ page }) => {
  await page.goto("/portfolio");
  await acceptRiskNotice(page);

  await expect(page.getByText("Transaktion eintragen")).toBeVisible();
  await expect(page.getByText("Szenarioanalyse")).toBeVisible();
  await expect(page.getByText("Portfolio-Warnungen")).toBeVisible();
});

test("learn and pricing pages explain beginner and business paths", async ({ page }) => {
  await page.goto("/learn");
  await acceptRiskNotice(page);

  await expect(page.getByText("Investieren lernen")).toBeVisible();
  await expect(page.getByText("Was ist eine Aktie?")).toBeVisible();
  await expect(page.getByText("1.000 € mtl.")).toBeVisible();

  await page.goto("/pricing");
  await acceptRiskNotice(page);

  await expect(page.getByText("Free")).toBeVisible();
  await expect(page.getByText("Elite / Business")).toBeVisible();
  await expect(page.getByText("Feature-Gates vorbereitet")).toBeVisible();
});

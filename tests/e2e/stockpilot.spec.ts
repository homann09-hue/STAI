import { expect, test } from "@playwright/test";

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    await button.evaluate((element) => {
      if (element instanceof HTMLButtonElement) element.click();
    });
  }
}

async function safeGoto(page: import("@playwright/test").Page, route: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "load", timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 2 || !String(error).includes("ERR_ABORTED")) throw error;
      await page.waitForTimeout(300);
    }
  }
}

test("dashboard exposes market, data quality and disclaimer", async ({ page }) => {
  await page.goto("/");
  await acceptRiskNotice(page);

  await expect(page.getByRole("link", { name: /StockPilot AI/ })).toBeVisible();
  await expect(page.getByText("Datenqualität", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Mock Data|Near-Realtime|Delayed|Realtime/).first()).toBeVisible();
  await expect(page.getByText("Globale Kursübersicht")).toBeVisible();
  await expect(page.getByRole("button", { name: "1T" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Candle" })).toBeVisible();
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
  await expect(page.getByText(/Provider:/).first()).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elite / Business", exact: true })).toBeVisible();
  await expect(page.getByText("Feature-Gates vorbereitet")).toBeVisible();
});

test("settings contains investor mode instead of dashboard", async ({ page }) => {
  await page.goto("/");
  await acceptRiskNotice(page);
  await expect(page.getByText("Aktiver Modus")).toHaveCount(0);

  await page.goto("/settings");
  await acceptRiskNotice(page);
  await expect(page.locator("main").getByText("Einstellungen").first()).toBeVisible();
  await expect(page.getByText("Zielgruppen-Modus")).toBeVisible();
  await expect(page.getByRole("button", { name: "Anfänger Einfache Sprache, Ampel, Risiko zuerst." })).toBeVisible();
});

test("professional finance terminal pages render core data areas", async ({ page }) => {
  await safeGoto(page, "/markets");
  await acceptRiskNotice(page);
  await expect(page.getByText("Global Market Overview").first()).toBeVisible();
  await expect(page.getByText("Profi-Datenzentrum")).toBeVisible();
  await expect(page.getByText("Qualitäts-Summary")).toBeVisible();

  await safeGoto(page, "/stocks");
  await expect(page.getByText("Aktien-Screener").first()).toBeVisible();
  await expect(page.getByText("Forward P/E").first()).toBeVisible();

  await safeGoto(page, "/etfs");
  await expect(page.getByText("ETF-Screener").first()).toBeVisible();
  await expect(page.getByText("Top 10 Holdings").first()).toBeVisible();

  await safeGoto(page, "/crypto");
  await expect(page.getByText("Krypto-Screener").first()).toBeVisible();
  await expect(page.getByText("Exchange-Daten").first()).toBeVisible();

  await page.goto("/news-terminal");
  await expect(page.getByText("News & Events mit Quellenstatus")).toBeVisible();

  await page.goto("/risk");
  await expect(page.getByText("Risiko-Dashboard").first()).toBeVisible();

  await page.goto("/compare");
  await expect(page.getByText("Vergleichsseite").first()).toBeVisible();
});

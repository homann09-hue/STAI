import { expect, test } from "@playwright/test";

const routes = ["/", "/assets/NVDA", "/assets/AAPL", "/assets/MSFT", "/assets/VOO", "/assets/BTC-USD", "/assets/ETH-USD", "/learn", "/portfolio", "/alerts", "/pricing", "/offline"];
const apiRoutes = [
  "/api/market/overview",
  "/api/assets/NVDA",
  "/api/assets/BTC-USD",
  "/api/news?symbol=NVDA",
  "/api/fundamentals/NVDA",
  "/api/ai/analysis?symbol=NVDA",
  "/api/portfolio",
  "/api/alerts"
];

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
}

test.describe("deep red-team browser checks", () => {
  test("all primary pages render without console errors", async ({ page }) => {
    test.setTimeout(60_000);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await acceptRiskNotice(page);
      await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("all visible links have reachable local hrefs", async ({ page }) => {
    await page.goto("/");
    await acceptRiskNotice(page);

    const hrefs = await page.locator("a[href]").evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]
    );

    expect(hrefs.length).toBeGreaterThan(4);

    for (const href of hrefs) {
      expect(href).not.toContain("javascript:");
      expect(href).not.toContain("undefined");
      if (href?.startsWith("/")) {
        const response = await page.request.get(href);
        expect(response.status(), href).toBeLessThan(400);
      }
    }
  });

  test("API endpoints validate responses and unsafe inputs", async ({ request }) => {
    for (const route of apiRoutes) {
      const response = await request.get(route);
      expect(response.status(), route).toBeLessThan(400);
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    }

    const unsafeAsset = await request.get("/api/assets/%3Cscript%3E");
    expect(unsafeAsset.status()).toBe(400);

    const unsafeAlert = await request.post("/api/alerts", {
      data: {
        symbol: "<script>",
        type: "price",
        label: "Bad",
        condition: "Bad"
      }
    });
    expect(unsafeAlert.status()).toBe(400);
  });

  test("portfolio form accepts transaction and updates UI", async ({ page }) => {
    await page.goto("/portfolio");
    await acceptRiskNotice(page);

    await page.getByLabel("Symbol").fill("MSFT");
    await page.getByLabel("Branche / Thema").fill("Software / Cloud");
    await page.getByLabel("Menge").fill("2");
    await page.getByLabel("Durchschnittskurs").fill("500");
    await page.getByLabel("Risiko je Position 0-100").fill("45");
    await page.getByRole("button", { name: "Vorgang speichern" }).click();

    await expect(page.getByText("MSFT").first()).toBeVisible();
  });

  test("alerts form creates all professional alert categories", async ({ page }) => {
    await page.goto("/alerts");
    await acceptRiskNotice(page);

    await page.getByLabel("Symbol").fill("AAPL");
    await page.getByLabel("Typ").selectOption("portfolio-risk");
    await page.getByLabel("Bedingung").fill("Gesamtrisiko über 70/100");
    await page.getByRole("button", { name: "Alert erstellen" }).click();

    const alertList = page.getByTestId("alert-list");
    await expect(alertList.getByText("Portfolio-Risikoalarm").first()).toBeVisible();
    await expect(alertList.getByText("Gesamtrisiko über 70/100").first()).toBeVisible();
  });

  test("asset detail shows mock-data caveat and data timestamps", async ({ page }) => {
    await page.goto("/assets/NVDA");
    await acceptRiskNotice(page);

    await expect(page.getByText("Mock-Daten").first()).toBeVisible();
    await expect(page.getByText("Datenqualität").first()).toBeVisible();
    await expect(page.getByText("Diese Wahrscheinlichkeit ist keine Garantie und kann falsch sein.").first()).toBeVisible();
  });

  test("new fintech surfaces are usable on mobile and desktop", async ({ page }) => {
    await page.goto("/");
    await acceptRiskNotice(page);

    await expect(page.getByText("Anfänger").first()).toBeVisible();
    await page.getByRole("button", { name: "Profi Szenarien, Drawdown, Governance." }).click();
    await expect(page.getByText("Aktiver Modus: Profi").first()).toBeVisible();

    await page.goto("/learn");
    await expect(page.getByText("Glossar")).toBeVisible();

    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
    await expect(page.getByText("mehrere Portfolios")).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
}

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
      window.setTimeout(() => resolve(), 1500);
    });
  });
}

test.describe("offline PWA review", () => {
  test("cached shell, local snapshots and stale public APIs work offline", async ({ page, context }) => {
    test.setTimeout(60_000);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptRiskNotice(page);
    await waitForServiceWorker(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await acceptRiskNotice(page);

    for (const route of ["/watchlist", "/portfolio", "/assets/NVDA", "/offline"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await acceptRiskNotice(page);
      await expect(page.locator("main")).toBeVisible();
    }

    await page.evaluate(async () => {
      await fetch("/api/assets/NVDA");
      await fetch("/api/news?symbol=NVDA");
      await fetch("/api/ai/analysis?symbol=NVDA");
    });

    await context.setOffline(true);

    await page.goto("/watchlist", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cloud-Watchlist" })).toBeVisible();
    await expect(page.getByText(/Offline-Watchlist|Lokale Provider-Watchlist|Lokale Watchlist/).first()).toBeVisible();
    await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();

    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Positionen und Risiko")).toBeVisible();
    await expect(page.getByText(/Offline-Portfolio|Lokaler Portfolio-Modus/).first()).toBeVisible();

    await page.goto("/assets/NVDA", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("NVDA").first()).toBeVisible();
    await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();

    const staleApi = await page.evaluate(async () => {
      const response = await fetch("/api/assets/NVDA");
      return {
        contentType: response.headers.get("content-type"),
        ok: response.ok,
        status: response.status
      };
    });
    expect(staleApi).toMatchObject({ ok: true, status: 200 });
    expect(staleApi.contentType).toContain("application/json");

    await page.goto("/offline", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Offline-Modus")).toBeVisible();
  });
});

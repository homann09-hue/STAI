import { expect, test } from "@playwright/test";

const routes = ["/", "/markets", "/stocks", "/etfs", "/crypto", "/indices", "/screener", "/watchlist", "/news-terminal", "/intelligence", "/calendar", "/analyses", "/backtesting", "/risk", "/compare", "/assets/NVDA", "/assets/AAPL", "/assets/MSFT", "/assets/VOO", "/assets/BTC-USD", "/assets/ETH-USD", "/learn", "/portfolio", "/alerts", "/pricing", "/settings", "/offline"];
/**
 * Routen, die **ohne Konto** eine gueltige Antwort liefern muessen.
 *
 * `/api/professional/overview` stand hier und ist entfernt: die Route ist seit
 * der Entitlement-Durchsetzung gegatet und antwortet ohne Anmeldung mit 401.
 * Das ist das gewuenschte Verhalten -- der Profi-Inhalt lag vorher fuer jeden
 * Besucher offen. Die Gegenprobe dazu steht weiter unten.
 */
const apiRoutes = [
  "/api/market/overview",
  "/api/market/universe",
  "/api/market/quotes?symbols=NVDA,AAPL,BTC-USD",
  "/api/assets/NVDA",
  "/api/assets/BTC-USD",
  "/api/news?symbol=NVDA",
  "/api/fundamentals/NVDA",
  "/api/portfolio",
  "/api/alerts"
];

/**
 * Routen, die ohne Konto **nicht** liefern duerfen.
 *
 * Sie stehen bewusst nicht in `apiRoutes`: dort lautet die Zusicherung
 * "antwortet erfolgreich", und genau das sollen diese Routen nicht tun. Ihre
 * eigene Zusicherung steht weiter unten.
 */
const gatedRoutes = ["/api/professional/overview", "/api/ai/analysis?symbol=NVDA"];

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  await button.waitFor({ state: "visible", timeout: 2000 }).catch(() => undefined);
  if (await button.isVisible().catch(() => false)) {
    await button.click({ force: true });
    await expect(page.getByRole("dialog", { name: "Wichtiger Risiko-Hinweis" })).toHaveCount(0, { timeout: 3000 });
  }
}

async function safeGoto(page: import("@playwright/test").Page, route: string, waitUntil: "domcontentloaded" | "load" = "domcontentloaded") {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil, timeout: 20_000 });
      return;
    } catch (error) {
      if (attempt === 2 || !String(error).includes("ERR_ABORTED")) throw error;
      await page.waitForTimeout(300);
    }
  }
}

test.describe("deep red-team browser checks", () => {
  test("all primary pages render without console errors", async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    // Erwartete Meldungen ausnehmen: ohne Supabase-Konfiguration antworten die
    // gegateten Routen mit 503, und der Browser protokolliert den fehlgeschlagenen
    // Abruf. Das ist die gewollte Reaktion -- der Guard schliesst, statt bei
    // fehlender Konfiguration zu oeffnen. Alles andere bleibt ein Fehler.
    const expectedGuardNoise = /Failed to load resource.*(503|401|402|403)|professional\/overview|ai\/analysis/i;

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (expectedGuardNoise.test(message.text())) return;
      consoleErrors.push(message.text());
    });

    for (const route of routes) {
      await safeGoto(page, route);
      await acceptRiskNotice(page);
      await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test("all visible links have reachable local hrefs", async ({ page }) => {
    await safeGoto(page, "/");
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

  test("gated routes stay closed without an account", async ({ request }) => {
    // Die Gegenprobe zu `/api/professional/overview` in der Liste oben. Ohne
    // diesen Test haette das Entfernen der Route aus `apiRoutes` die Pruefung
    // nur geloescht statt verschoben -- und niemand haette gemerkt, wenn der
    // Profi-Inhalt wieder offen liegt.
    for (const route of gatedRoutes) {
      const response = await request.get(route);

      // 503 gehoert ausdruecklich dazu. In dieser Umgebung ist Supabase nicht
      // konfiguriert, `getSupabaseAuth` meldet `missing_client`, und der Guard
      // unterscheidet dann zwischen "abgelehnt" und "nicht pruefbar" -- er
      // antwortet mit 503 statt mit 401.
      //
      // Fuer diesen Test ist beides derselbe Befund: die Route liefert
      // **keinen** Profi-Inhalt ohne Konto. Ein Guard, der bei fehlender
      // Konfiguration oeffnet statt zu schliessen, waere der Fehler -- und
      // genau den wuerde diese Zusicherung fangen.
      expect([401, 402, 403, 503], route).toContain(response.status());
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      // Kein CDN-Cache auf einer gegateten Antwort: sonst liefert das CDN den
      // Bezahlinhalt nach einem berechtigten Aufruf an alle weiteren aus.
      expect(response.headers()["cache-control"] ?? "").toMatch(/no-store|private/);
    }
  });

  test("portfolio form accepts transaction and updates UI", async ({ page }) => {
    await safeGoto(page, "/portfolio");
    await acceptRiskNotice(page);

    await page.getByLabel("Symbol").fill("MSFT");
    await page.getByLabel("Branche / Thema").fill("Software / Cloud");
    await page.getByLabel("Menge").fill("2");
    await page.getByLabel("Durchschnittskurs").fill("500");
    await page.getByLabel("Ihre Risikoeinschätzung 0-100").fill("45");
    await page.getByRole("button", { name: "Vorgang speichern" }).click();

    await expect(page.getByText("MSFT").first()).toBeVisible();
  });

  test("alerts form creates all professional alert categories", async ({ page }) => {
    await safeGoto(page, "/alerts");
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
    await safeGoto(page, "/assets/NVDA");
    await acceptRiskNotice(page);

    await expect(page.getByText("Mock-Daten").first()).toBeVisible();
    await expect(page.getByText(/Mock Data|Near-Realtime|Delayed|Realtime/).first()).toBeVisible();
    await expect(page.getByText(/Provider:/).first()).toBeVisible();
    await expect(page.getByText("Datenqualität").first()).toBeVisible();
    await expect(page.getByText("Diese Wahrscheinlichkeit ist keine Garantie und kann falsch sein.").first()).toBeVisible();
  });

  test("new fintech surfaces are usable on mobile and desktop", async ({ page }) => {
    await safeGoto(page, "/");
    await acceptRiskNotice(page);

    await expect(page.getByText("Aktiver Modus")).toHaveCount(0);

    await safeGoto(page, "/settings", "load");
    await expect(page.getByText("Zielgruppen-Modus")).toBeVisible();
    await page.getByRole("button", { name: "Profi Szenarien, Drawdown, Governance." }).click();
    await expect(page.getByText("Aktiver Modus: Profi").first()).toBeVisible();

    await safeGoto(page, "/learn", "load");
    await expect(page.getByText("Glossar")).toBeVisible();

    await safeGoto(page, "/pricing", "load");
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
    await expect(page.getByText("mehrere Portfolios")).toBeVisible();
  });

  test("intelligence feed stays honest when backend data is unavailable", async ({ page }) => {
    await safeGoto(page, "/intelligence", "load");
    await acceptRiskNotice(page);
    await expect(page.getByRole("heading", { name: "Ereignisse verstehen, Quellen prüfen." })).toBeVisible();
    await expect(page.getByText(/keine Mock-Ereignisse/i)).toBeVisible();
    await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const auditDir = path.join(process.cwd(), "docs", "audits", "mobile-review");
const auditedRoutes = [
  { name: "dashboard", path: "/", title: "Dashboard" },
  { name: "markets", path: "/markets", title: "Märkte" },
  { name: "asset-nvda", path: "/assets/NVDA", title: "Asset Detail" },
  { name: "portfolio", path: "/portfolio", title: "Portfolio" },
  { name: "settings", path: "/settings", title: "Einstellungen" }
];

async function acceptRiskNotice(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
}

test.describe("mobile review", () => {
  test("core mobile surfaces fit, navigate and expose safe touch targets", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile review only runs against mobile-chrome.");
    test.setTimeout(60_000);
    await fs.mkdir(auditDir, { recursive: true });
    const notes: string[] = [
      "# StockPilot AI Mobile Review",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Scope: Pixel 7 viewport via Playwright mobile-chrome. Evidence covers visual layout, horizontal overflow, critical touch targets and bottom navigation.",
      ""
    ];

    for (const [index, route] of auditedRoutes.entries()) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await acceptRiskNotice(page);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Keine Anlageberatung").first()).toBeVisible();

      const metrics = await page.evaluate(() => {
        function isVisible(element: Element) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        }

        const viewportWidth = window.innerWidth;
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const interactiveElements = Array.from(
          document.querySelectorAll("a[href], button, input, select, textarea, [role='button']")
        ).filter(isVisible);
        const criticalSmallTargets = interactiveElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const label =
              element.getAttribute("aria-label") ||
              element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
              element.tagName.toLowerCase();

            return {
              label,
              tag: element.tagName.toLowerCase(),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          })
          .filter((target) => target.width < 24 || target.height < 24);
        const warningTargets = interactiveElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label:
                element.getAttribute("aria-label") ||
                element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
                element.tagName.toLowerCase(),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          })
          .filter((target) => target.width < 44 || target.height < 44)
          .slice(0, 12);

        return {
          viewportWidth,
          documentWidth,
          horizontalOverflowPx: Math.max(0, documentWidth - viewportWidth),
          criticalSmallTargets,
          warningTargets,
          visibleInteractiveCount: interactiveElements.length
        };
      });

      const screenshotName = `${String(index + 1).padStart(2, "0")}-${route.name}.png`;
      await page.screenshot({
        fullPage: true,
        path: path.join(auditDir, screenshotName)
      });

      notes.push(`## ${index + 1}. ${route.title}`);
      notes.push("");
      notes.push(`- Route: \`${route.path}\``);
      notes.push(`- Screenshot: \`${screenshotName}\``);
      notes.push(`- Horizontal overflow: ${metrics.horizontalOverflowPx}px`);
      notes.push(`- Visible interactive elements: ${metrics.visibleInteractiveCount}`);
      notes.push(`- Critical targets under 24px: ${metrics.criticalSmallTargets.length}`);
      notes.push(`- Targets below 44px recommendation: ${metrics.warningTargets.length}`);
      if (metrics.warningTargets.length) {
        notes.push(`- Touch warning sample: ${metrics.warningTargets.map((target) => `${target.label} (${target.width}x${target.height})`).join("; ")}`);
      }
      notes.push("");

      expect(metrics.horizontalOverflowPx, `${route.path} must not cause page-level horizontal overflow`).toBeLessThanOrEqual(2);
      expect(metrics.criticalSmallTargets, `${route.path} has touch targets below 24px`).toEqual([]);
    }

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptRiskNotice(page);
    await page.getByRole("link", { name: "Märkte", exact: true }).click();
    await expect(page).toHaveURL(/\/markets$/);
    await expect(page.getByText("Global Market Overview").first()).toBeVisible();

    await page.getByRole("link", { name: "Portfolio", exact: true }).click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.getByText("Transaktion eintragen")).toBeVisible();

    notes.push("## Navigation");
    notes.push("");
    notes.push("- Bottom navigation successfully opened Märkte and Portfolio on mobile.");
    notes.push("");

    await fs.writeFile(path.join(auditDir, "mobile-review.md"), notes.join("\n"), "utf8");
  });
});

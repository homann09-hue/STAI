import { expect, type Page } from "@playwright/test";

/**
 * Dismisses the legal notice without racing React hydration.
 *
 * The dialog is part of the server-rendered shell, so a visible button does
 * not prove that its click handler is attached yet. Persisting the acceptance
 * first and reloading only when the hydrated click did not close the dialog
 * keeps the test deterministic while still exercising the real control.
 */
export async function acceptRiskNotice(page: Page) {
  // `noticeAccepted` startet absichtlich mit `true` und wird erst im Effect aus
  // localStorage geladen. Deshalb muss die Zustimmung gesetzt werden, bevor
  // wir auf Sichtbarkeit pruefen; ein sofort unsichtbarer Dialog beweist noch
  // nicht, dass er nach der Hydration unsichtbar bleibt.
  await page.evaluate(() => {
    window.localStorage.setItem("stockpilot:risk-notice", "accepted");
  });

  const dialog = page.getByRole("dialog", { name: "Wichtiger Risiko-Hinweis" });
  await dialog.waitFor({ state: "visible", timeout: 300 }).catch(() => undefined);

  const button = page.getByRole("button", { name: "Verstanden" });
  if (await button.isVisible().catch(() => false)) {
    // The mobile notice intentionally overlaps the page. A normal pointer click
    // can be intercepted by the dialog backdrop while the fixed button settles.
    // Force the semantic button click, then reload only if hydration was not yet
    // ready to process it. The persisted consent was written above, so the reload
    // remains deterministic without weakening the product assertion.
    await button.click({ force: true });
    const dismissed = await dialog
      .waitFor({ state: "detached", timeout: 1000 })
      .then(() => true)
      .catch(() => false);

    if (!dismissed) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }

  await expect(dialog).toHaveCount(0, { timeout: 5000 });
}

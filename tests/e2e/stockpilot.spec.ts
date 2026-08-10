import { expect, test } from "@playwright/test";
import { acceptRiskNotice } from "./risk-notice";

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
  await page.addInitScript(() => {
    window.localStorage.setItem("stockpilot:investor-mode", "pro");
  });
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

  // Die Tarife heissen Free, Pro und Premium. "Elite / Business" stand hier
  // noch aus der Zeit davor -- der Test lief seit der Umbenennung nie, weil
  // E2E nur in `redteam.yml` und `vercel-manual.yml` haengt und beide nur
  // manuell starten.
  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Premium", exact: true })).toBeVisible();
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

test("professional finance terminal pages enforce the account gate", async ({ page }) => {
  const protectedRoutes = ["/markets", "/stocks", "/etfs", "/crypto", "/news-terminal", "/risk", "/compare"];

  for (const route of protectedRoutes) {
    await safeGoto(page, route);
    await acceptRiskNotice(page);

    // Ohne verifizierte Sitzung muss jede Profi-Seite fail-closed reagieren.
    // In CI fehlt absichtlich ein Supabase-Client; deshalb darf der Test nicht
    // so tun, als waere ein bezahlter Tarif vorhanden. Der eigentliche
    // Profi-Inhalt wird separat auf Komponenten- und API-Ebene getestet.
    await expect(page.getByText(/Pro-Tarif|Anmeldung|nicht verfügbar|sicher prüfen/i).first()).toBeVisible();
    await expect(page.getByTestId("professional-overview")).toHaveCount(0);
  }
});

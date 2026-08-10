// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvestorModeDock } from "./investor-mode-dock";
import { INVESTOR_MODE_EVENT, INVESTOR_MODE_STORAGE_KEY } from "@/lib/investor-mode";
import { setInvestorMode } from "@/lib/use-investor-mode";

beforeEach(() => {
  window.localStorage.clear();
  setInvestorMode("beginner");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("InvestorModeDock", () => {
  it("speichert die Auswahl und aktualisiert die aktive Analyse-Tiefe", () => {
    const { container } = render(<InvestorModeDock />);

    const advanced = screen.getByRole("button", {
      name: "Fortgeschritten Kennzahlen, News, Vergleiche."
    });
    fireEvent.click(advanced);

    expect(advanced.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem(INVESTOR_MODE_STORAGE_KEY)).toBe("advanced");
    expect(document.documentElement.dataset.investorMode).toBe("advanced");
    expect(container.textContent).toMatch(/Aktiver Modus: Fortgeschritten/);
  });

  it("benachrichtigt andere Ansichten im selben Browser-Tab", () => {
    const listener = vi.fn();
    window.addEventListener(INVESTOR_MODE_EVENT, listener);
    render(<InvestorModeDock />);

    fireEvent.click(
      screen.getByRole("button", { name: "Profi Szenarien, Drawdown, Governance." })
    );

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(INVESTOR_MODE_EVENT, listener);
  });
});

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "@/components/auth-form";

const authMocks = vi.hoisted(() => ({
  updateUser: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      updateUser: authMocks.updateUser
    }
  })
}));

afterEach(() => {
  cleanup();
  authMocks.updateUser.mockReset();
});

describe("Passwort zurücksetzen", () => {
  it("zeigt ein Bestätigungsfeld und blockiert Tippfehler", () => {
    render(<AuthForm mode="reset" />);

    fireEvent.change(screen.getByLabelText(/Passwort/, { selector: "#auth-password" }), {
      target: { value: "korrekt pferd batterie" }
    });
    fireEvent.change(screen.getByLabelText("Neues Passwort wiederholen"), {
      target: { value: "korrekt pferd batterei" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));

    expect(screen.getByText("Die beiden Passwörter stimmen nicht überein.")).toBeTruthy();
    expect(
      screen
        .getByLabelText(/Neues Passwort wiederholen/, { selector: "#auth-password-confirm" })
        .getAttribute("aria-invalid")
    ).toBe("true");
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("sendet nur zwei identische sichere Passwörter", async () => {
    authMocks.updateUser.mockResolvedValue({ error: null });
    render(<AuthForm mode="reset" />);

    fireEvent.change(screen.getByLabelText(/Passwort/, { selector: "#auth-password" }), {
      target: { value: "korrekt pferd batterie" }
    });
    fireEvent.change(screen.getByLabelText("Neues Passwort wiederholen"), {
      target: { value: "korrekt pferd batterie" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));

    await waitFor(() => {
      expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "korrekt pferd batterie" });
    });
    expect(screen.getByRole("status").textContent).toContain("Passwort gespeichert");
  });
});

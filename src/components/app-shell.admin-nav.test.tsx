// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Adminpunkt in der Navigation.
 *
 * Die Zusicherung hier ist eng und wichtig: **der Punkt erscheint nur, wenn die
 * Auskunft ausdrücklich `true` sagt.** Alles andere — kein Konto, ein Fehler,
 * ein unerwartetes Format — blendet ihn aus.
 *
 * Was diese Tests ausdrücklich *nicht* behaupten: dass die Navigation den
 * Adminbereich schützt. Sie tut es nicht und soll es nicht. Der Schutz sitzt in
 * den Routen, die `/admin` aufruft; die hier geprüfte Sichtbarkeit ist reine
 * Anzeige. Ein Test, der aus einem versteckten Menüpunkt eine
 * Sicherheitsaussage machte, wäre schlimmer als keiner — er würde ein
 * Sicherheitsgefühl erzeugen, für das die Grundlage woanders liegt.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// Die Kinder von AppShell sind für diese Frage ohne Belang; die schweren
// Teilkomponenten wuerden nur Netzwerkaufrufe und Zeitgeber mitbringen.
vi.mock("@/components/global-command-palette", () => ({ GlobalCommandPalette: () => null }));
vi.mock("@/components/billing-plan-badge", () => ({ BillingPlanBadge: () => null }));
vi.mock("@/components/notification-center", () => ({ NotificationCenter: () => null }));
vi.mock("@/components/PwaRegister", () => ({ PwaRegister: () => null }));
vi.mock("@/components/risk-notice-dialog", () => ({ RiskNoticeDialog: () => null }));

const fetchWithSupabaseAuth = vi.fn();
vi.mock("@/lib/supabase/client-fetch", () => ({
  fetchWithSupabaseAuth: (...args: unknown[]) => fetchWithSupabaseAuth(...args)
}));

const { AppShell } = await import("@/components/AppShell");

function respondWith(body: unknown, ok = true) {
  fetchWithSupabaseAuth.mockResolvedValue({ ok, json: async () => body });
}

beforeEach(() => {
  fetchWithSupabaseAuth.mockReset();
});

afterEach(() => {
  cleanup();
});

const adminLink = () => screen.queryAllByRole("link", { name: /Verwaltung/ });

describe("mit Adminrecht", () => {
  it("zeigt den Punkt Verwaltung", async () => {
    respondWith({ isAdmin: true });

    render(<AppShell>Inhalt</AppShell>);

    await waitFor(() => expect(adminLink().length).toBeGreaterThan(0));
    expect(adminLink()[0]).toHaveProperty("href", expect.stringContaining("/admin"));
  });
});

describe("ohne Adminrecht", () => {
  it("blendet den Punkt aus", async () => {
    respondWith({ isAdmin: false });

    render(<AppShell>Inhalt</AppShell>);

    // Erst abwarten, dass die Auskunft ueberhaupt geholt wurde -- sonst
    // prueft der Test nur, dass die Seite noch nicht fertig geladen ist.
    await waitFor(() => expect(fetchWithSupabaseAuth).toHaveBeenCalledWith("/api/account/role"));
    expect(adminLink()).toHaveLength(0);
  });

  it("blendet ihn auch bei einer fehlgeschlagenen Auskunft aus", async () => {
    // Fail closed: ein Netzwerkfehler darf keinen Adminpunkt erzeugen.
    fetchWithSupabaseAuth.mockRejectedValue(new Error("offline"));

    render(<AppShell>Inhalt</AppShell>);

    await waitFor(() => expect(fetchWithSupabaseAuth).toHaveBeenCalled());
    expect(adminLink()).toHaveLength(0);
  });

  it("blendet ihn bei einem Fehlerstatus aus", async () => {
    respondWith({ isAdmin: true }, false);

    render(<AppShell>Inhalt</AppShell>);

    await waitFor(() => expect(fetchWithSupabaseAuth).toHaveBeenCalled());
    expect(adminLink()).toHaveLength(0);
  });

  it("lässt sich nicht mit einem wahrheitsähnlichen Wert überreden", async () => {
    // `payload.isAdmin === true` statt `Boolean(payload.isAdmin)`. Der
    // Unterschied ist hier keine Pedanterie: eine Antwort, die aus irgendeinem
    // Grund `"false"` oder `1` liefert, darf keine Rechte suggerieren.
    respondWith({ isAdmin: "true" });

    render(<AppShell>Inhalt</AppShell>);

    await waitFor(() => expect(fetchWithSupabaseAuth).toHaveBeenCalled());
    expect(adminLink()).toHaveLength(0);
  });
});

describe("die Navigation bleibt sonst unverändert", () => {
  it("zeigt die Produktpunkte unabhängig vom Adminrecht", async () => {
    respondWith({ isAdmin: false });

    render(<AppShell>Inhalt</AppShell>);

    await waitFor(() => expect(fetchWithSupabaseAuth).toHaveBeenCalled());
    expect(screen.queryAllByRole("link", { name: /Portfolio/ }).length).toBeGreaterThan(0);
  });
});

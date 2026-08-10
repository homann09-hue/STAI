import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithSupabaseAuth } from "./client-fetch";

const { createBrowserClientMock, getSessionMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(),
  getSessionMock: vi.fn()
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: createBrowserClientMock
}));

describe("fetchWithSupabaseAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { origin: "https://stockpilot.test" } });
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "access-token" } } });
    createBrowserClientMock.mockReturnValue({ auth: { getSession: getSessionMock } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent authenticated GET requests and returns independent responses", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ isAdmin: false }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      fetchWithSupabaseAuth("/api/account/role"),
      fetchWithSupabaseAuth("/api/account/role")
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/role",
      expect.objectContaining({ headers: expect.any(Headers) })
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    await expect(first.json()).resolves.toEqual({ isAdmin: false });
    await expect(second.json()).resolves.toEqual({ isAdmin: false });
  });

  it("does not forward authorization headers to external origins", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithSupabaseAuth("https://example.com/status", {
      headers: { Authorization: "Bearer attacker-controlled" }
    });

    expect(getSessionMock).not.toHaveBeenCalled();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  });
});

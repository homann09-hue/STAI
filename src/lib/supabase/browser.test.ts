import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ client: "supabase-browser" }))
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

describe("Supabase browser client", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://stockpilot.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_browser_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns one shared client for the browser runtime", async () => {
    const { createSupabaseBrowserClient } = await import("./browser");

    const first = createSupabaseBrowserClient();
    const second = createSupabaseBrowserClient();

    expect(first).toBe(second);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://stockpilot.supabase.co",
      "sb_publishable_browser_test"
    );
  });

  it("fails closed for unsafe URLs and secret keys", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://stockpilot.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_must_not_reach_the_browser");
    const { createSupabaseBrowserClient } = await import("./browser");

    expect(createSupabaseBrowserClient()).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

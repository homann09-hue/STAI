import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CreateClientCall = {
  url: string;
  key: string;
  options?: { global?: { headers?: Record<string, string> } };
};

const { calls } = vi.hoisted(() => ({ calls: [] as CreateClientCall[] }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options?: CreateClientCall["options"]) => {
    calls.push({ url, key, options });
    return { __client: true, url, key, options };
  }
}));

const VALID_URL = "https://example-project.supabase.co";
const SERVICE_KEY = "sb_secret_service_role_key_value";
const PUBLISHABLE_KEY = "sb_publishable_anon_key_value";
const ACCESS_TOKEN = "user-access-token";

const originalEnv = { ...process.env };

beforeEach(() => {
  calls.length = 0;
  delete process.env.STOCKPILOT_ALLOW_TEST_FIXTURES;
  process.env.NEXT_PUBLIC_SUPABASE_URL = VALID_URL;
  process.env.SUPABASE_SECRET_KEY = SERVICE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

async function loadServerModule() {
  return import("./server");
}

describe("createSupabaseUserClient", () => {
  it("binds the request to the caller identity so RLS enforces tenant isolation", async () => {
    const { createSupabaseUserClient } = await loadServerModule();
    const client = createSupabaseUserClient(ACCESS_TOKEN);

    expect(client).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].options?.global?.headers?.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("never sends the service role key, because that key bypasses RLS entirely", async () => {
    const { createSupabaseUserClient } = await loadServerModule();
    createSupabaseUserClient(ACCESS_TOKEN);

    expect(calls[0].key).toBe(PUBLISHABLE_KEY);
    expect(calls[0].key).not.toBe(SERVICE_KEY);
    expect(JSON.stringify(calls[0])).not.toContain(SERVICE_KEY);
  });

  it("falls back to the anon key when no publishable key is configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_legacy_anon_key";

    const { createSupabaseUserClient } = await loadServerModule();
    createSupabaseUserClient(ACCESS_TOKEN);

    expect(calls[0].key).toBe("sb_publishable_legacy_anon_key");
  });

  it("refuses to build a client without an access token", async () => {
    const { createSupabaseUserClient } = await loadServerModule();

    expect(createSupabaseUserClient("")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("refuses non-Supabase and non-https hosts", async () => {
    const { createSupabaseUserClient } = await loadServerModule();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://attacker.example.com";
    expect(createSupabaseUserClient(ACCESS_TOKEN)).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://example-project.supabase.co";
    expect(createSupabaseUserClient(ACCESS_TOKEN)).toBeNull();

    expect(calls).toHaveLength(0);
  });

  it("allows an exact loopback Supabase URL only in the explicit test fixture harness", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    const { createSupabaseUserClient } = await loadServerModule();

    expect(createSupabaseUserClient(ACCESS_TOKEN)).toBeNull();

    process.env.STOCKPILOT_ALLOW_TEST_FIXTURES = "true";
    expect(createSupabaseUserClient(ACCESS_TOKEN)).not.toBeNull();
    expect(calls[0].url).toBe("http://127.0.0.1:54321");
  });

  it.each([
    "http://attacker.example",
    "http://127.0.0.1.attacker.example:54321",
    "http://user:password@127.0.0.1:54321",
    "http://127.0.0.1:54321/rest/v1",
    "http://127.0.0.1:54321/?redirect=https://attacker.example"
  ])("rejects unsafe fixture URL %s", async (url) => {
    process.env.STOCKPILOT_ALLOW_TEST_FIXTURES = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    const { createSupabaseUserClient } = await loadServerModule();

    expect(createSupabaseUserClient(ACCESS_TOKEN)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("createSupabaseServiceClient", () => {
  it("uses the service role key and sends no user authorization header", async () => {
    const { createSupabaseServiceClient } = await loadServerModule();
    const client = createSupabaseServiceClient();

    expect(client).not.toBeNull();
    expect(calls[0].key).toBe(SERVICE_KEY);
    expect(calls[0].options?.global?.headers?.Authorization).toBeUndefined();
  });

  it("rejects a publishable key mistakenly configured as the service key", async () => {
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_not_a_service_key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { createSupabaseServiceClient } = await loadServerModule();

    expect(createSupabaseServiceClient()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("allows the local service client only inside the explicit test fixture harness", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.STOCKPILOT_ALLOW_TEST_FIXTURES = "true";
    const { createSupabaseServiceClient } = await loadServerModule();

    expect(createSupabaseServiceClient()).not.toBeNull();
    expect(calls[0].url).toBe("http://localhost:54321");
  });
});

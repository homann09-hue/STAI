import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockAccountDeletionError extends Error {
    constructor(readonly code: string, readonly status: 409 | 503, message: string) {
      super(message);
    }
  }
  return {
    getSupabaseAuth: vi.fn(),
    getUser: vi.fn(),
    runAccountDeletion: vi.fn(),
    AccountDeletionError: MockAccountDeletionError
  };
});

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: (request: Request) => mocks.getSupabaseAuth(request)
}));

vi.mock("@/lib/account-deletion", () => ({
  AccountDeletionError: mocks.AccountDeletionError,
  runAccountDeletion: (auth: unknown) => mocks.runAccountDeletion(auth)
}));

function deletionRequest(input: { body?: unknown; origin?: string } = {}) {
  return new Request("https://stockpilot.test/api/account", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      origin: input.origin ?? "https://stockpilot.test",
      "x-real-ip": `10.8.0.${Math.floor(Math.random() * 200) + 1}`
    },
    body: JSON.stringify(input.body ?? { confirmation: "KONTO LÖSCHEN" })
  });
}

async function callRoute(request = deletionRequest()) {
  const { DELETE } = await import("./route");
  const response = await DELETE(request);
  return { response, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.getSupabaseAuth.mockResolvedValue({
    ok: true,
    userId: "11111111-1111-4111-8111-111111111111",
    supabase: { auth: { getUser: mocks.getUser } }
  });
  mocks.getUser.mockResolvedValue({
    data: { user: { last_sign_in_at: new Date().toISOString() } },
    error: null
  });
  mocks.runAccountDeletion.mockResolvedValue({
    deleted: true,
    deletionId: "22222222-2222-4222-8222-222222222222"
  });
});

describe("DELETE /api/account", () => {
  it("deletes only after a fresh server-verified sign-in", async () => {
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.runAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it("requires re-authentication when the last sign-in is older than ten minutes", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { last_sign_in_at: new Date(Date.now() - 11 * 60_000).toISOString() } },
      error: null
    });

    const { response } = await callRoute();

    expect(response.status).toBe(428);
    expect(response.headers.get("X-StockPilot-Reauthentication")).toBe("required");
    expect(mocks.runAccountDeletion).not.toHaveBeenCalled();
  });

  it("returns a stable conflict for a duplicate in-progress deletion", async () => {
    mocks.runAccountDeletion.mockRejectedValue(
      new mocks.AccountDeletionError("already_running", 409, "Eine Kontolöschung wird bereits verarbeitet.")
    );

    const { response, body } = await callRoute();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Eine Kontolöschung wird bereits verarbeitet.");
  });

  it("rejects an anonymous request", async () => {
    mocks.getSupabaseAuth.mockResolvedValue({ ok: false, reason: "anonymous" });

    const { response } = await callRoute();

    expect(response.status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects a session that Supabase cannot verify", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });

    const { response } = await callRoute();

    expect(response.status).toBe(401);
    expect(mocks.runAccountDeletion).not.toHaveBeenCalled();
  });

  it("does not expose an unexpected server error", async () => {
    mocks.runAccountDeletion.mockRejectedValue(new Error("private provider details"));

    const { response, body } = await callRoute();

    expect(response.status).toBe(503);
    expect(String(body.error)).not.toContain("private provider details");
  });

  it("rejects a cross-origin deletion request before authentication", async () => {
    const { response } = await callRoute(deletionRequest({ origin: "https://attacker.invalid" }));

    expect(response.status).toBe(403);
    expect(mocks.getSupabaseAuth).not.toHaveBeenCalled();
  });

  it("rejects an invalid confirmation payload", async () => {
    const { response } = await callRoute(deletionRequest({ body: { confirmation: "JA" } }));

    expect(response.status).toBe(400);
    expect(mocks.getSupabaseAuth).toHaveBeenCalledTimes(1);
  });

  it("does not reveal the confirmation contract to anonymous callers", async () => {
    mocks.getSupabaseAuth.mockResolvedValue({ ok: false, reason: "anonymous" });

    const { response } = await callRoute(deletionRequest({ body: { confirmation: "JA" } }));

    expect(response.status).toBe(401);
  });
});

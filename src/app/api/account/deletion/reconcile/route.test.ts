import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));

vi.mock("@/lib/account-deletion", () => ({
  reconcileAccountDeletionJobs: () => mocks.reconcile()
}));

function request(secret = "cron-test-secret") {
  return new Request("https://stockpilot.test/api/account/deletion/reconcile", {
    headers: { authorization: `Bearer ${secret}`, "x-real-ip": `10.9.0.${Math.floor(Math.random() * 200) + 1}` }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.CRON_SECRET = "cron-test-secret";
  mocks.reconcile.mockResolvedValue({ inspected: 1, completed: 1, skipped: 0, failed: 0 });
});

describe("GET /api/account/deletion/reconcile", () => {
  it("runs only with the server cron secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ completed: 1 });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid secret without touching deletion jobs", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("fails closed when the cron secret is missing", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.STOCKPILOT_CRON_SECRET;
    const { GET } = await import("./route");
    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns a safe error when reconciliation fails", async () => {
    mocks.reconcile.mockRejectedValue(new Error("private database details"));
    const { GET } = await import("./route");
    const response = await GET(request());
    const body = await response.json() as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).not.toContain("private database details");
  });
});

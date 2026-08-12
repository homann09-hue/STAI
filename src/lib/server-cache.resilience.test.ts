import { beforeEach, describe, expect, it } from "vitest";
import { getServerCacheAdapter } from "@/lib/server-cache";

describe("server cache resilience primitives", () => {
  const cache = getServerCacheAdapter();

  beforeEach(async () => {
    await cache.clear();
  });

  it("acquires a cache lock exactly once", async () => {
    const acquired = await Promise.all(
      Array.from({ length: 100 }, () =>
        cache.setIfAbsent("lock:quote:AAPL", "owner", 10_000),
      ),
    );

    expect(acquired.filter(Boolean)).toHaveLength(1);
  });

  it("increments concurrent process-local budgets without lost updates", async () => {
    const values = await Promise.all(
      Array.from({ length: 200 }, () => cache.increment("budget", 60_000)),
    );

    expect(new Set(values).size).toBe(200);
    await expect(cache.get<number>("budget")).resolves.toBe(200);
  });

  it("allows a lock to be acquired after explicit release", async () => {
    await expect(cache.setIfAbsent("lock", "first", 10_000)).resolves.toBe(true);
    await expect(cache.setIfAbsent("lock", "second", 10_000)).resolves.toBe(false);
    await cache.delete("lock");
    await expect(cache.setIfAbsent("lock", "third", 10_000)).resolves.toBe(true);
  });

  it("does not let an old owner delete a replacement lock", async () => {
    await cache.setIfAbsent("owned-lock", "new-owner", 10_000);

    await expect(
      cache.deleteIfValue("owned-lock", "old-owner"),
    ).resolves.toBe(false);
    await expect(cache.get<string>("owned-lock")).resolves.toBe("new-owner");
    await expect(
      cache.deleteIfValue("owned-lock", "new-owner"),
    ).resolves.toBe(true);
  });
});

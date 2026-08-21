import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planLimitContract, pricingTiers } from "@/lib/feature-gates";

function collectActiveTsx(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectActiveTsx(path);
    if (!entry.endsWith(".tsx") || entry.includes(".test.")) return [];
    return [readFileSync(path, "utf8")];
  });
}

describe("Free/Pro/Premium plan contract", () => {
  it("keeps pricing and every TypeScript limit on the canonical contract", () => {
    expect(pricingTiers.map(({ id, limits }) => ({ id, limits }))).toEqual([
      { id: "free", limits: planLimitContract.free },
      { id: "pro", limits: planLimitContract.pro },
      { id: "premium", limits: planLimitContract.premium }
    ]);
  });

  it("keeps the PostgreSQL snapshot byte-for-byte aligned with the canonical values", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260821171602_unify_free_pro_premium_limits.sql"),
      "utf8"
    );

    expect(migration).toMatch(/\('free',\s*1,\s*15,\s*3,\s*1,\s*1,\s*3,\s*0\)/);
    expect(migration).toMatch(/\('pro',\s*2,\s*250,\s*100,\s*10,\s*10,\s*100,\s*1000\)/);
    expect(migration).toMatch(/\('premium',\s*3,\s*1000,\s*500,\s*25,\s*20,\s*500,\s*10000\)/);
  });

  it("contains no obsolete plan names in active app copy", () => {
    const source = [
      ...collectActiveTsx(join(process.cwd(), "src/app")),
      ...collectActiveTsx(join(process.cwd(), "src/components"))
    ].join("\n");

    expect(source).not.toMatch(/\b(?:Starter|Elite|Business)\b/);
  });
});

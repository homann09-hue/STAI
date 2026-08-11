import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/billing/feature-guard.ts"), "utf8");

describe("quota tenant boundary", () => {
  it("uses the RLS-bound user client for quota consumption", () => {
    expect(source).toContain('auth.supabase.rpc("consume_feature_quota"');
    expect(source).not.toContain('auth.serviceSupabase.rpc("consume_feature_quota"');
  });

  it("does not send a caller-selected user id to the quota function", () => {
    const quotaCall = source.slice(source.indexOf('rpc("consume_feature_quota"'), source.indexOf("if (error)"));
    expect(quotaCall).not.toContain("p_user_id");
    expect(quotaCall).toContain("p_feature");
    expect(quotaCall).toContain("p_limit");
  });
});

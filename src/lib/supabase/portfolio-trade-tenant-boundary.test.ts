import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/supabase/user-data.ts"), "utf8");
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260811193000_harden_portfolio_trade_tenant_identity.sql"),
  "utf8"
);

describe("portfolio trade tenant boundary", () => {
  it("uses the RLS-bound user client for atomic portfolio trades", () => {
    expect(source).toContain('auth.supabase.rpc("apply_portfolio_trade"');
    expect(source).not.toContain('auth.serviceSupabase.rpc("apply_portfolio_trade"');
  });

  it("does not send a caller-selected user id to the trade function", () => {
    const start = source.indexOf('rpc("apply_portfolio_trade"');
    const tradeCall = source.slice(start, source.indexOf("if (error)", start));

    expect(start).toBeGreaterThan(-1);
    expect(tradeCall).not.toContain("p_user_id");
    expect(tradeCall).toContain("p_symbol");
    expect(tradeCall).toContain("p_quantity");
  });

  it("binds database ownership to auth.uid and removes the legacy overload", () => {
    expect(migration).toContain("owner_id uuid := auth.uid()");
    expect(migration).toContain("drop function if exists public.apply_portfolio_trade(\n  uuid,");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public, anon, service_role");
  });
});

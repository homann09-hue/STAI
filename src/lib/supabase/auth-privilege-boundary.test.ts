import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./user-data.ts", import.meta.url)),
  "utf8"
);

function section(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Supabase privilege boundary", () => {
  it("validates ordinary requests with the token-bound RLS client", () => {
    const auth = section(
      "export async function getSupabaseAuth",
      "function requireServiceSupabase"
    );

    expect(auth).toContain("createSupabaseUserClient(token)");
    expect(auth).toContain("supabase.auth.getUser(token)");
    expect(auth).not.toContain("createSupabaseServiceClient");
    expect(auth).not.toContain("serviceSupabase");
  });

  it("does not carry a privileged client in the authentication result", () => {
    const result = section("type AuthResult", "type AlertRuleRow");

    expect(result).toContain("supabase: SupabaseClient");
    expect(result).not.toContain("serviceSupabase");
  });

  it("creates a service client only inside the two privileged account operations", () => {
    const serviceFactory = section(
      "function requireServiceSupabase",
      "function alertFromRow"
    );
    const accountExport = section(
      "export async function exportUserData",
      "export async function deleteUserAccount"
    );
    const accountDeletion = section(
      "export async function deleteUserAccount",
      "export async function deleteUserPortfolioPosition"
    );

    expect(serviceFactory).toContain("createSupabaseServiceClient()");
    expect(accountExport).toContain('requireServiceSupabase("account_export")');
    expect(accountDeletion).toContain(
      'requireServiceSupabase("account_deletion")'
    );
  });
});

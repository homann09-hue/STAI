import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_REAUTH_MAX_AGE_MS,
  isAccountDeletionLeaseAvailable,
  isFreshAccountAuthentication,
  isTerminalStripeSubscription
} from "@/lib/account-deletion-policy";

const NOW = Date.parse("2026-08-17T16:00:00.000Z");

describe("account deletion policy", () => {
  it("requires a recent, valid sign-in", () => {
    expect(isFreshAccountAuthentication(new Date(NOW - 60_000).toISOString(), NOW)).toBe(true);
    expect(
      isFreshAccountAuthentication(new Date(NOW - ACCOUNT_DELETION_REAUTH_MAX_AGE_MS - 1).toISOString(), NOW)
    ).toBe(false);
    expect(isFreshAccountAuthentication("invalid", NOW)).toBe(false);
    expect(isFreshAccountAuthentication(null, NOW)).toBe(false);
  });

  it("accepts only a small clock skew into the future", () => {
    expect(isFreshAccountAuthentication(new Date(NOW + 30_000).toISOString(), NOW)).toBe(true);
    expect(isFreshAccountAuthentication(new Date(NOW + 120_000).toISOString(), NOW)).toBe(false);
  });

  it("does not cancel terminal Stripe subscriptions again", () => {
    expect(isTerminalStripeSubscription("canceled")).toBe(true);
    expect(isTerminalStripeSubscription("incomplete_expired")).toBe(true);
    expect(isTerminalStripeSubscription("active")).toBe(false);
    expect(isTerminalStripeSubscription("past_due")).toBe(false);
  });

  it("reclaims only expired or missing leases", () => {
    expect(isAccountDeletionLeaseAvailable(null, NOW)).toBe(true);
    expect(isAccountDeletionLeaseAvailable(new Date(NOW - 1).toISOString(), NOW)).toBe(true);
    expect(isAccountDeletionLeaseAvailable(new Date(NOW + 1).toISOString(), NOW)).toBe(false);
  });
});

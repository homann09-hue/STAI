export const ACCOUNT_DELETION_REAUTH_MAX_AGE_MS = 10 * 60 * 1_000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1_000;

export function isFreshAccountAuthentication(
  lastSignInAt: string | null | undefined,
  now = Date.now()
) {
  if (!lastSignInAt) return false;
  const authenticatedAt = Date.parse(lastSignInAt);
  if (!Number.isFinite(authenticatedAt)) return false;
  const age = now - authenticatedAt;
  return age >= -CLOCK_SKEW_TOLERANCE_MS && age <= ACCOUNT_DELETION_REAUTH_MAX_AGE_MS;
}

export function isTerminalStripeSubscription(status: string) {
  return status === "canceled" || status === "incomplete_expired";
}

export function isAccountDeletionLeaseAvailable(
  leaseExpiresAt: string | null | undefined,
  now = Date.now()
) {
  if (!leaseExpiresAt) return true;
  const expiresAt = Date.parse(leaseExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

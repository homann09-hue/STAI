export type StripeSubscriptionSnapshot = {
  customerId: string;
  status: string;
};

export type StripeCheckoutDisposition =
  | { action: "checkout"; customerId: string }
  | { action: "portal"; customerId: string; statuses: string[]; paymentRecoveryRequired: boolean }
  | { action: "support"; customerCount: number; statuses: string[] };

const terminalStatuses = new Set(["canceled", "incomplete_expired"]);
const paymentRecoveryStatuses = new Set(["past_due", "unpaid", "incomplete", "paused"]);

const statusPriority: Record<string, number> = {
  unpaid: 0,
  past_due: 1,
  incomplete: 2,
  paused: 3,
  active: 4,
  trialing: 5
};

export function isTerminalStripeSubscriptionStatus(status: string) {
  return terminalStatuses.has(status);
}

export function requiresStripePaymentRecovery(status: string) {
  return paymentRecoveryStatuses.has(status);
}

function orderedStatuses(subscriptions: readonly StripeSubscriptionSnapshot[]) {
  return [...new Set(subscriptions.map((subscription) => subscription.status))].sort(
    (left, right) => (statusPriority[left] ?? 100) - (statusPriority[right] ?? 100) || left.localeCompare(right)
  );
}

export function decideStripeCheckoutDisposition(input: {
  customerIds: readonly string[];
  subscriptions: readonly StripeSubscriptionSnapshot[];
  preferredCustomerId?: string | null;
}): StripeCheckoutDisposition {
  const customerIds = [...new Set(input.customerIds)].sort();
  if (customerIds.length === 0) throw new Error("stripe_customer_missing");

  const nonTerminal = input.subscriptions.filter(
    (subscription) => customerIds.includes(subscription.customerId) && !isTerminalStripeSubscriptionStatus(subscription.status)
  );
  const affectedCustomers = [...new Set(nonTerminal.map((subscription) => subscription.customerId))].sort();
  const statuses = orderedStatuses(nonTerminal);

  if (affectedCustomers.length > 1) {
    return { action: "support", customerCount: affectedCustomers.length, statuses };
  }

  if (affectedCustomers.length === 1) {
    return {
      action: "portal",
      customerId: affectedCustomers[0],
      statuses,
      paymentRecoveryRequired: statuses.some(requiresStripePaymentRecovery)
    };
  }

  const preferred = input.preferredCustomerId;
  return {
    action: "checkout",
    customerId: preferred && customerIds.includes(preferred) ? preferred : customerIds[0]
  };
}


import "server-only";
import type Stripe from "stripe";
import { ensureStripeCustomer, isValidEmail } from "@/lib/billing/stripe";
import {
  decideStripeCheckoutDisposition,
  type StripeCheckoutDisposition,
  type StripeSubscriptionSnapshot
} from "@/lib/billing/subscription-recovery";

const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9_:-]{3,160}$/;
const MAX_CUSTOMERS = 1_000;
const MAX_SUBSCRIPTIONS = 2_000;

type StripeIdentity = {
  userId: string;
  email: string | null;
  knownCustomerId?: string | null;
};

export class StripeSubscriptionRecoveryError extends Error {
  constructor(public readonly code: "customer_limit" | "subscription_limit") {
    super(code);
    this.name = "StripeSubscriptionRecoveryError";
  }
}

function addCustomerId(ids: Set<string>, candidate: unknown) {
  if (typeof candidate === "string" && STRIPE_CUSTOMER_PATTERN.test(candidate)) ids.add(candidate);
  if (ids.size > MAX_CUSTOMERS) throw new StripeSubscriptionRecoveryError("customer_limit");
}

async function discoverStripeCustomerIds(stripe: Stripe, identity: StripeIdentity) {
  const ids = new Set<string>();
  addCustomerId(ids, identity.knownCustomerId);

  let searchPage: string | undefined;
  do {
    const customers = await stripe.customers.search({
      query: `metadata['stockpilot_user_id']:'${identity.userId}'`,
      limit: 100,
      ...(searchPage ? { page: searchPage } : {})
    });
    for (const customer of customers.data) {
      if (customer.metadata?.stockpilot_user_id === identity.userId) addCustomerId(ids, customer.id);
    }
    searchPage = customers.next_page ?? undefined;
  } while (searchPage);

  if (isValidEmail(identity.email)) {
    let startingAfter: string | undefined;
    do {
      const customers = await stripe.customers.list({
        email: identity.email,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });
      for (const customer of customers.data) {
        if (customer.metadata?.stockpilot_user_id === identity.userId) addCustomerId(ids, customer.id);
      }
      startingAfter = customers.has_more ? customers.data.at(-1)?.id : undefined;
    } while (startingAfter);
  }

  return [...ids].sort();
}

async function loadSubscriptions(stripe: Stripe, customerIds: readonly string[]) {
  const subscriptions: StripeSubscriptionSnapshot[] = [];

  for (const customerId of customerIds) {
    let startingAfter: string | undefined;
    do {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });
      for (const subscription of page.data) {
        subscriptions.push({ customerId, status: subscription.status });
        if (subscriptions.length > MAX_SUBSCRIPTIONS) {
          throw new StripeSubscriptionRecoveryError("subscription_limit");
        }
      }
      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
    } while (startingAfter);
  }

  return subscriptions;
}

async function loadStripeBillingState(stripe: Stripe, identity: StripeIdentity, createCustomer: boolean) {
  const discoveredCustomerIds = await discoverStripeCustomerIds(stripe, identity);
  const customerIds = new Set(discoveredCustomerIds);

  if (customerIds.size === 0 && createCustomer) {
    const customer = await ensureStripeCustomer(stripe, identity.userId, identity.email);
    addCustomerId(customerIds, customer.id);
  }

  const normalizedCustomerIds = [...customerIds].sort();

  return {
    customerIds: normalizedCustomerIds,
    subscriptions: await loadSubscriptions(stripe, normalizedCustomerIds)
  };
}

export async function resolveStripeCheckoutDisposition(
  stripe: Stripe,
  identity: StripeIdentity
): Promise<StripeCheckoutDisposition> {
  const state = await loadStripeBillingState(stripe, identity, true);
  return decideStripeCheckoutDisposition({
    ...state,
    preferredCustomerId: identity.knownCustomerId
  });
}

export async function resolveStripePortalCustomer(stripe: Stripe, identity: StripeIdentity) {
  const state = await loadStripeBillingState(stripe, identity, false);
  if (state.customerIds.length === 0) return null;

  const disposition = decideStripeCheckoutDisposition({
    ...state,
    preferredCustomerId: identity.knownCustomerId
  });
  if (disposition.action === "support") throw new Error("multiple_subscription_customers");
  return disposition.customerId;
}

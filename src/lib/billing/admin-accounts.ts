import "server-only";
import { pickEffectiveEntitlement, type EntitlementRow } from "@/lib/billing/entitlements";
import { getIntervalForStripePriceId, getStripeBillingConfiguration } from "@/lib/billing/stripe";
import { summarizeRecurringRevenue, type RevenueBreakdown, type SubscriptionRecord } from "@/lib/billing/revenue";
import type { PlanId } from "@/lib/feature-gates";

/**
 * Der Datenteil des Adminbereichs — bewusst ohne Datenbankzugriff.
 *
 * Die Route holt die Zeilen, dieses Modul entscheidet, was sie bedeuten. Damit
 * lässt sich die Bedeutung prüfen, ohne eine Datenbank zu stellen — und die
 * Fälle, auf die es ankommt (mehrere Einträge je Konto, manuelle
 * Freischaltungen, unbekannte Preise), lassen sich als Fixture hinschreiben.
 */

export type ProfileRow = {
  id?: unknown;
  email?: unknown;
  display_name?: unknown;
  created_at?: unknown;
  is_admin?: unknown;
};

export type AdminAccount = {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  isAdmin: boolean;
  plan: PlanId;
  status: string;
  provider: string;
  /** Woran der Zugang hängt — für die Frage „darf ich das von Hand ändern?". */
  managedByStripe: boolean;
  validUntil: string | null;
  cancelAtPeriodEnd: boolean;
  interval: "month" | "year" | null;
};

export type AdminAccountsView = {
  accounts: AdminAccount[];
  revenue: RevenueBreakdown;
  /** Wie viele Konten es insgesamt gibt — die Liste kann gekürzt sein. */
  totalAccounts: number;
  billingConfigured: boolean;
};

function text(value: unknown, max = 254): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, max) : null;
}

function rowsByUser(entitlements: readonly EntitlementRow[]) {
  const grouped = new Map<string, EntitlementRow[]>();

  for (const row of entitlements) {
    const userId = text((row as { user_id?: unknown }).user_id, 36);
    if (!userId) continue;
    const existing = grouped.get(userId);
    if (existing) existing.push(row);
    else grouped.set(userId, [row]);
  }

  return grouped;
}

function intervalOf(resolved: { providerPriceId: string | null }) {
  return resolved.providerPriceId ? getIntervalForStripePriceId(resolved.providerPriceId) : null;
}

export function buildAdminAccountsView(input: {
  profiles: readonly ProfileRow[];
  entitlements: readonly EntitlementRow[];
  totalAccounts: number;
  now?: number;
}): AdminAccountsView {
  const billingConfigured = getStripeBillingConfiguration().entitlementsConfigured;
  const options = { billingConfigured, now: input.now };
  const grouped = rowsByUser(input.entitlements);

  const accounts = input.profiles.flatMap<AdminAccount>((profile) => {
    const userId = text(profile.id, 36);
    if (!userId) return [];

    const resolved = pickEffectiveEntitlement(grouped.get(userId) ?? [], options);

    return [
      {
        userId,
        email: text(profile.email),
        displayName: text(profile.display_name, 80),
        createdAt: text(profile.created_at, 40),
        isAdmin: profile.is_admin === true,
        plan: resolved.plan,
        status: resolved.status,
        provider: resolved.provider,
        managedByStripe: resolved.provider === "stripe" && resolved.billingActive,
        validUntil: resolved.validUntil,
        cancelAtPeriodEnd: resolved.cancelAtPeriodEnd,
        interval: intervalOf(resolved)
      }
    ];
  });

  // Der Umsatz wird über **alle** übergebenen Abo-Zeilen gerechnet, nicht über
  // die angezeigte Kontoliste. Sonst hinge die MRR an der Seitengröße der
  // Tabelle — eine Zahl, die sich beim Blättern ändert, ist keine Kennzahl.
  const records: SubscriptionRecord[] = [...grouped.values()].map((rows) => {
    const resolved = pickEffectiveEntitlement(rows, options);
    return {
      plan: resolved.plan,
      status: resolved.status,
      provider: resolved.provider,
      interval: intervalOf(resolved)
    };
  });

  return {
    accounts,
    revenue: summarizeRecurringRevenue(records),
    totalAccounts: input.totalAccounts,
    billingConfigured
  };
}

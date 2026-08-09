"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchBillingEntitlements } from "@/lib/billing/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function BillingPlanBadge() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [label, setLabel] = useState("Free / lokal");

  useEffect(() => {
    let disposed = false;

    const load = async (accessToken?: string | null) => {
      try {
        const entitlement = await fetchBillingEntitlements(accessToken);
        if (disposed) return;
        if (entitlement.degraded) {
          setLabel("Free / Statusfehler");
          return;
        }
        const suffix = entitlement.billingActive ? entitlement.status : entitlement.mode === "local" ? "lokal" : "aktiv";
        setLabel(`${entitlement.plan === "free" ? "Free" : entitlement.plan.toUpperCase()} / ${suffix}`);
      } catch {
        if (!disposed) setLabel("Free / Status unbekannt");
      }
    };

    if (!supabase) {
      void load();
      return () => {
        disposed = true;
      };
    }

    void supabase.auth.getSession().then(({ data }) => load(data.session?.access_token));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void load(session?.access_token), 0);
    });

    return () => {
      disposed = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  return <p className="text-xs text-muted" aria-live="polite">{label}</p>;
}

"use client";

import { CreditCard, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatGermanDate } from "@/lib/date-time";

type EntitlementResponse = {
  billingActive: boolean;
  plan: string;
  status: string;
  provider: string;
  validUntil: string | null;
  error: string | null;
};

export function BillingActionsPanel() {
  const supabase = createSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [billing, setBilling] = useState<EntitlementResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let disposed = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!disposed) setSession(data.session ?? null);
      })
      .catch(() => {
        if (!disposed) setSession(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!disposed) setSession(nextSession);
    });

    return () => {
      disposed = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      setBilling(null);
      return;
    }

    let disposed = false;

    async function fetchBilling() {
      setBusy(true);
      setMessage(null);

      if (!session?.access_token) {
        setMessage("Ungültige Supabase-Session. Bitte neu anmelden.");
        setBusy(false);
        return;
      }

      try {
        const response = await fetch("/api/billing/entitlements", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        const payload = (await response.json()) as EntitlementResponse & { error?: string };

        if (!response.ok || payload.error) {
          setMessage(payload.error || "Billing-Status konnte nicht abgerufen werden.");
          return;
        }

        if (!disposed) {
          setBilling(payload);
        }
      } catch {
        if (!disposed) setMessage("Billing-Status konnte nicht geladen werden. Bitte später erneut versuchen.");
      } finally {
        if (!disposed) setBusy(false);
      }
    }

    fetchBilling();

    return () => {
      disposed = true;
    };
  }, [session]);

  async function openBillingPortal() {
    if (!session) {
      setMessage("Bitte zuerst einloggen, um das Billing-Portal zu öffnen.");
      return;
    }

    setBusy(true);
    setMessage(null);

    if (!session?.access_token) {
      setMessage("Ungültige Supabase-Session. Bitte neu anmelden.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      const payload = await response.json();

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Portal-URL konnte nicht geladen werden.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setMessage(String(error instanceof Error ? error.message : "Billing-Portal konnte nicht geöffnet werden."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan/25 bg-cyan/10 text-cyan">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-mist">Billing-Status</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Diese Ansicht zeigt, ob ein Supabase-Login verbunden ist und ob eine aktive Stripe-Entitlement-Zeile vorliegt.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Cloud-Login</p>
          <p className="mt-2 text-sm text-mist">{session ? `Verbunden als ${session.user.email ?? "angemeldeter Nutzer"}` : "Nicht angemeldet"}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Abonnement</p>
          <p className="mt-2 text-sm text-mist">
            {billing ? (billing.billingActive ? `${billing.plan} aktiv` : `Kein aktives Abonnement (${billing.status})`) : "Nicht bestätigt"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Provider</p>
          <p className="mt-2 text-sm text-mist">{billing?.provider ?? "unbekannt"}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Gültig bis</p>
          <p className="mt-2 text-sm text-mist">{billing?.validUntil ? formatGermanDate(billing.validUntil) : "nicht gesetzt"}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Letzter Check</p>
          <p className="mt-2 text-sm text-mist">{busy ? "aktualisiert..." : billing ? "aktuell" : "nicht geladen"}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={openBillingPortal}
          disabled={!session || busy}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Abonnement verwalten
        </button>
        <div className="rounded-2xl border border-stroke bg-coal/70 p-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-profit" />
            <span>Billing-Portal für Stripe-Benutzer.</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Wenn keine aktive Entitlement-Zeile gefunden wird, bleibt das Produkt weiterhin im Demo-/Free-Modus.
          </p>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-amber/25 bg-amber/10 p-4 text-sm text-amber">{message}</div>
      ) : null}
    </section>
  );
}

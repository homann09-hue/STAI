"use client";

import { AlertTriangle, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatEuroCents } from "@/lib/billing/revenue";
import { formatGermanDate } from "@/lib/date-time";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import type { AdminAccount, AdminAccountsView } from "@/lib/billing/admin-accounts";

type ViewResponse = AdminAccountsView & { listTruncated: boolean };

type GrantResponse = {
  plan: string;
  validUntil: string;
  stripeSubscriptionRemains: boolean;
  message: string;
  audited: boolean;
};

const planLabels: Record<string, string> = { free: "FREE", pro: "PRO", premium: "PREMIUM" };

const statusLabels: Record<string, string> = {
  demo: "kein Abo",
  active: "aktiv",
  trialing: "Testzeitraum",
  past_due: "Zahlung offen",
  unpaid: "unbezahlt",
  canceled: "gekündigt",
  expired: "abgelaufen",
  incomplete: "unvollständig",
  paused: "pausiert"
};

function formatDate(value: string | null) {
  return formatGermanDate(value);
}

export function AdminAccountsPanel() {
  const [view, setView] = useState<ViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth(`/api/admin/accounts?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as ViewResponse & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Die Kontenliste ist gerade nicht abrufbar.");
        setView(null);
        return;
      }

      setView(payload);
    } catch {
      setError("Die Kontenliste ließ sich nicht laden.");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function changePlan(account: AdminAccount, plan: string) {
    const reason =
      plan === "free" ? null : window.prompt(`Grund für ${planLabels[plan]} auf ${account.email ?? account.userId}?`);

    if (plan !== "free" && (reason === null || reason.trim().length < 3)) return;

    setBusyUserId(account.userId);
    setNotice(null);

    try {
      const response = await fetchWithSupabaseAuth("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: account.userId, plan, reason, months: 12 })
      });
      const payload = (await response.json()) as GrantResponse & { error?: string };

      if (!response.ok) {
        setNotice(payload.error ?? "Die Änderung wurde nicht gespeichert.");
        return;
      }

      setNotice(
        payload.audited
          ? payload.message
          : `${payload.message} Hinweis: Der Protokolleintrag ist nicht geschrieben worden.`
      );
      await load(search);
    } catch {
      setNotice("Die Änderung ließ sich nicht senden.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Konten und Abos</h2>
          <p className="text-sm text-muted-foreground">
            Alle registrierten Konten mit ihrem wirksamen Tarif. Manuelle Freischaltungen zählen nicht in den Umsatz.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(search)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Neu laden
        </button>
      </header>

      {view ? <RevenueCards view={view} /> : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search);
        }}
      >
        <label className="sr-only" htmlFor="admin-account-search">
          Konto per E-Mail suchen
        </label>
        <input
          id="admin-account-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="E-Mail-Adresse"
          className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
        />
        <button type="submit" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Search className="h-4 w-4" aria-hidden="true" />
          Suchen
        </button>
      </form>

      {notice ? (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          wird geladen
        </p>
      ) : null}

      {view && !loading ? (
        <>
          {view.listTruncated ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Die Liste zeigt {view.accounts.length} von {view.totalAccounts} Konten. Die Umsatzzahlen oben umfassen
              trotzdem alle.
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registrierte Konten mit Tarif und Status</caption>
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Konto</th>
                  <th scope="col" className="py-2 pr-4">Tarif</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 pr-4">Quelle</th>
                  <th scope="col" className="py-2 pr-4">Gültig bis</th>
                  <th scope="col" className="py-2">Tarif setzen</th>
                </tr>
              </thead>
              <tbody>
                {view.accounts.map((account) => (
                  <tr key={account.userId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-2">
                        {account.isAdmin ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" aria-label="Adminkonto" />
                        ) : null}
                        {account.email ?? account.userId}
                      </span>
                      <span className="text-xs text-muted-foreground">seit {formatDate(account.createdAt)}</span>
                    </td>
                    <td className="py-2 pr-4 font-medium">{planLabels[account.plan] ?? account.plan}</td>
                    <td className="py-2 pr-4">{statusLabels[account.status] ?? account.status}</td>
                    <td className="py-2 pr-4">
                      {account.provider === "stripe"
                        ? `Stripe${account.interval === "year" ? ", jährlich" : account.interval === "month" ? ", monatlich" : ""}`
                        : account.provider === "manual"
                          ? "von Hand"
                          : "—"}
                    </td>
                    <td className="py-2 pr-4">{formatDate(account.validUntil)}</td>
                    <td className="py-2">
                      <label className="sr-only" htmlFor={`plan-${account.userId}`}>
                        Tarif für {account.email ?? account.userId} setzen
                      </label>
                      <select
                        id={`plan-${account.userId}`}
                        className="rounded-md border px-2 py-1 text-sm"
                        disabled={busyUserId === account.userId}
                        value=""
                        onChange={(event) => {
                          const plan = event.target.value;
                          event.target.value = "";
                          if (plan) void changePlan(account, plan);
                        }}
                      >
                        <option value="">wählen …</option>
                        <option value="pro">PRO freischalten</option>
                        <option value="premium">PREMIUM freischalten</option>
                        <option value="free">Freischaltung entziehen</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {view.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kein Konto gefunden.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RevenueCards({ view }: { view: ViewResponse }) {
  const { revenue } = view;

  const cards = [
    { label: "MRR", value: formatEuroCents(revenue.mrrCents), note: `${revenue.payingAccounts} zahlende Abos` },
    { label: "ARR", value: formatEuroCents(revenue.arrCents), note: "Fortschreibung der MRR, keine Messung" },
    {
      label: "Zahlung offen",
      value: formatEuroCents(revenue.atRiskCents),
      note: `${revenue.atRiskAccounts} Abos ohne Zahlungseingang`
    },
    {
      label: "Ohne Umsatz",
      value: `${revenue.compedAccounts + revenue.trialingAccounts}`,
      note: `${revenue.compedAccounts} von Hand, ${revenue.trialingAccounts} im Test`
    }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
        </div>
      ))}

      {revenue.unpricedAccounts > 0 ? (
        <p className="sm:col-span-2 lg:col-span-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {revenue.unpricedAccounts} Abo(s) lassen sich keinem hinterlegten Preis zuordnen und fehlen deshalb in der
          MRR. Meist eine Preis-ID, die keine Umgebungsvariable mehr nennt.
        </p>
      ) : null}

      {!view.billingConfigured ? (
        <p className="sm:col-span-2 lg:col-span-4 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Stripe ist in dieser Umgebung nicht vollständig konfiguriert. Stripe-Abos gelten deshalb als nicht aktiv —
          die Zahlen oben sind entsprechend unvollständig.
        </p>
      ) : null}
    </div>
  );
}

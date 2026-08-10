"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import type { PlanReadiness } from "@/lib/billing/plan-readiness";

type CostMetrics = {
  window: { days: number; since: string };
  totals: { cost: string; savedByCache: string; cacheHitRatePercent: number | null };
  byPlan: Array<{ plan: string; accounts: number; cost: string; margin: string }>;
  activeAccounts: number;
  costliestAccounts: Array<{ userId: string | null; plan: string; cost: string; fetches: number; margin: string }>;
  disclaimer: string;
};

type PlansResponse = {
  plans: Array<{
    id: string;
    name: string;
    pricing: { monthly: string; yearly: string | null };
    limits: Record<string, unknown>;
    includedFeatures: string[];
    announcedNotBuilt: string[];
  }>;
  readiness: PlanReadiness;
  editable: boolean;
  editableNote: string;
};

function useAdminResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth(url);
      const payload = (await response.json()) as T & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nicht abrufbar.");
        setData(null);
        return;
      }

      setData(payload);
    } catch {
      setError("Die Anfrage ist fehlgeschlagen.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading };
}

export function AdminCostPanel() {
  const { data, error, loading } = useAdminResource<CostMetrics>("/api/admin/cost-metrics?days=30");

  if (loading) return <Pending />;
  if (error) return <Failed message={error} />;
  if (!data) return null;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Kosten und Anbieter</h2>
        <p className="text-sm text-muted-foreground">
          Letzte {data.window.days} Tage ab {data.window.since}.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Datenkosten" value={data.totals.cost} note={`${data.activeAccounts} aktive Konten`} />
        <Card label="Durch Cache gespart" value={data.totals.savedByCache} note="gegenüber Abruf ohne Cache" />
        <Card
          label="Cache-Trefferquote"
          value={data.totals.cacheHitRatePercent === null ? "—" : `${data.totals.cacheHitRatePercent} %`}
          note={data.totals.cacheHitRatePercent === null ? "keine Abrufe im Zeitraum" : "der Abrufe kamen aus dem Cache"}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Kosten je Tarif</caption>
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              <th scope="col" className="py-2 pr-4">Tarif</th>
              <th scope="col" className="py-2 pr-4">Konten</th>
              <th scope="col" className="py-2 pr-4">Kosten</th>
              <th scope="col" className="py-2">Trägt der Tarif seine Kosten?</th>
            </tr>
          </thead>
          <tbody>
            {data.byPlan.map((row) => (
              <tr key={row.plan} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium uppercase">{row.plan}</td>
                <td className="py-2 pr-4">{row.accounts}</td>
                <td className="py-2 pr-4">{row.cost}</td>
                <td className="py-2">{row.margin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{data.disclaimer}</p>
    </section>
  );
}

export function AdminPlansPanel() {
  const { data, error, loading } = useAdminResource<PlansResponse>("/api/admin/plans");

  if (loading) return <Pending />;
  if (error) return <Failed message={error} />;
  if (!data) return null;

  const { readiness } = data;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Tarife und Grenzen</h2>
        <p className="text-sm text-muted-foreground">Was verkauft wird — und ob es sich kaufen lässt.</p>
      </header>

      {readiness.advertisedButUnbookable.length > 0 ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
          {readiness.advertisedButUnbookable.map((plan) => plan.toUpperCase()).join(" und ")} steht auf der
          Verkaufsseite, lässt sich aber in keinem Zeitraum kaufen. Der Kaufknopf führt ins Leere.
        </p>
      ) : null}

      {readiness.blockingGaps.length > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Es fehlt: {readiness.blockingGaps.join(", ")}. Solange das offen ist, ist kein Tarif buchbar.
          {readiness.blockingGaps.includes("STRIPE_WEBHOOK_SECRET")
            ? " Ohne Webhook läuft der Checkout zwar, aber die Freischaltung kommt nie an — der Kunde zahlt und bekommt nichts."
            : ""}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Buchbarkeit je Tarif und Zeitraum</caption>
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              <th scope="col" className="py-2 pr-4">Tarif</th>
              <th scope="col" className="py-2 pr-4">Zeitraum</th>
              <th scope="col" className="py-2 pr-4">Buchbar</th>
              <th scope="col" className="py-2">Fehlt</th>
            </tr>
          </thead>
          <tbody>
            {readiness.intervals.map((entry) => (
              <tr key={`${entry.plan}-${entry.interval}`} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium uppercase">{entry.plan}</td>
                <td className="py-2 pr-4">{entry.interval === "month" ? "monatlich" : "jährlich"}</td>
                <td className="py-2 pr-4">
                  {entry.bookable ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ja
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      nein
                    </span>
                  )}
                </td>
                <td className="py-2 font-mono text-xs">{entry.missing.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {data.plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border p-4">
            <p className="font-semibold">{plan.name}</p>
            <p className="text-sm text-muted-foreground">
              {plan.pricing.monthly}
              {plan.pricing.yearly ? ` · ${plan.pricing.yearly}` : ""}
            </p>
            <dl className="mt-3 space-y-1 text-xs">
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              {plan.includedFeatures.length} Funktionen enthalten
              {plan.announcedNotBuilt.length > 0
                ? `, ${plan.announcedNotBuilt.length} angekündigt und nicht gebaut`
                : ""}
            </p>
          </div>
        ))}
      </div>

      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">{data.editableNote}</p>
    </section>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Pending() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      wird geladen
    </p>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm">
      {message}
    </p>
  );
}

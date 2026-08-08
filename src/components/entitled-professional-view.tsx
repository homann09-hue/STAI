"use client";

import { useEffect, useState } from "react";
import { PaywallNotice } from "@/components/paywall-notice";
import { ProfessionalDataView } from "@/components/professional-data-view";
import type { FeaturePaywall } from "@/lib/billing/feature-access";
import type { PublicProviderCapabilityReport } from "@/lib/provider-health";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import type { ProfessionalMarketReport } from "@/lib/types";

/**
 * Zugangsgeprüfter Einstieg in das Profi-Terminal.
 *
 * Vorher holten `/markets` und `/risk` den Bericht direkt in der
 * Server-Komponente. Der kostenpflichtige Inhalt stand damit im ausgelieferten
 * HTML — für jeden Besucher, auch ohne Konto. Die Prüfung im Browser
 * nachzuholen hätte nichts geändert, weil die Daten da längst übertragen waren.
 *
 * Deshalb kommt der Bericht jetzt ausschließlich über `/api/professional/overview`,
 * und dort entscheidet der Server. Diese Komponente stellt nur noch dar, was sie
 * bekommen hat: die Daten, die Paywall oder einen ehrlichen Fehler.
 */

type Mode = "overview" | "stocks" | "etfs" | "crypto" | "news" | "risk" | "compare";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; report: ProfessionalMarketReport }
  | { status: "denied"; paywall: FeaturePaywall }
  | { status: "failed"; message: string };

function isPaywall(value: unknown): value is FeaturePaywall {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.reason === "string" && typeof candidate.message === "string";
}

export function EntitledProfessionalView({
  mode,
  providerCapabilities
}: {
  mode: Mode;
  providerCapabilities?: PublicProviderCapabilityReport;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const response = await fetchWithSupabaseAuth("/api/professional/overview", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (disposed) return;

        if (!response.ok) {
          if (payload && isPaywall(payload.paywall)) {
            setState({ status: "denied", paywall: payload.paywall });
            return;
          }
          setState({
            status: "failed",
            message: "Die Profi-Daten konnten nicht geladen werden. Es werden bewusst keine Ersatzwerte angezeigt."
          });
          return;
        }

        if (!payload) {
          setState({ status: "failed", message: "Die Antwort des Servers war unlesbar." });
          return;
        }

        // `metadata` beschreibt die Antwort, nicht den Bericht, und gehört
        // deshalb nicht in die Ansicht.
        const report = { ...payload };
        delete report.metadata;
        setState({ status: "ready", report: report as unknown as ProfessionalMarketReport });
      } catch {
        if (!disposed) {
          setState({
            status: "failed",
            message: "Die Profi-Daten sind gerade nicht erreichbar. Es werden bewusst keine Ersatzwerte angezeigt."
          });
        }
      }
    }

    void load();

    return () => {
      disposed = true;
    };
  }, [mode]);

  if (state.status === "loading") {
    return (
      <section className="rounded-3xl border border-stroke bg-panel p-5" aria-busy="true">
        <p className="text-sm text-muted">Profi-Daten werden geladen und der Tarif wird geprüft …</p>
      </section>
    );
  }

  if (state.status === "denied") {
    return <PaywallNotice paywall={state.paywall} />;
  }

  if (state.status === "failed") {
    return (
      <section className="rounded-3xl border border-loss/25 bg-loss/10 p-5">
        <h2 className="text-lg font-semibold text-mist">Profi-Daten nicht verfügbar</h2>
        <p className="mt-1 text-sm text-loss">{state.message}</p>
      </section>
    );
  }

  return <ProfessionalDataView report={state.report} mode={mode} providerCapabilities={providerCapabilities} />;
}

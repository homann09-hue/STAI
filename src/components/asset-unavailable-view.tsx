import Link from "next/link";
import { AlertTriangle, ArrowLeft, Lock, ServerCrash } from "lucide-react";
import type { AssetUnavailability } from "@/lib/asset-availability";

/**
 * Ehrliche Sackgassen-Ansicht.
 *
 * Vorher fuehrte jedes nicht ladbare Instrument auf `notFound()` — auch dann,
 * wenn es nachweislich existiert und nur der Datentarif es nicht abdeckt. Diese
 * Ansicht zeigt stattdessen, was bekannt ist, warum nichts geladen werden kann
 * und was der naechste Schritt ist.
 */
export function AssetUnavailableView({
  symbol,
  unavailability
}: {
  symbol: string;
  unavailability: AssetUnavailability;
}) {
  const { reason, identity, remediation } = unavailability;

  const tone =
    reason === "quote_not_entitled"
      ? { border: "border-amber/25", bg: "bg-amber/10", text: "text-amber", Icon: Lock }
      : reason === "provider_error"
        ? { border: "border-loss/25", bg: "bg-loss/10", text: "text-loss", Icon: ServerCrash }
        : { border: "border-stroke", bg: "bg-coal", text: "text-muted", Icon: AlertTriangle };

  const headline =
    reason === "quote_not_entitled"
      ? "Instrument bekannt, Daten nicht freigeschaltet"
      : reason === "provider_error"
        ? "Instrument bekannt, Abruf gerade nicht möglich"
        : "Instrument nicht gefunden";

  return (
    <div className="space-y-5">
      <Link
        href="/markets"
        className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-mist"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zurück zu den Märkten
      </Link>

      <section className={`rounded-3xl border ${tone.border} ${tone.bg} p-5`}>
        <div className="flex items-start gap-3">
          <tone.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.text}`} aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-mist">{headline}</h1>
            <p className={`mt-1 text-sm ${tone.text}`}>{unavailability.message}</p>
            {remediation ? <p className="mt-3 text-sm text-muted">{remediation}</p> : null}
          </div>
        </div>
      </section>

      {identity ? (
        <section className="rounded-3xl border border-stroke bg-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Was über {identity.symbol} bekannt ist
          </h2>
          <p className="mt-1 text-xs text-muted">
            Diese Angaben stammen aus dem Instrument Master und sind providerbelegt. Kurs-,
            Fundamental- und Analysedaten fehlen und werden bewusst nicht geschätzt.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Name", identity.name],
              ["Assetklasse", identity.assetClass],
              ["Handelsplatz", identity.exchange],
              ["Währung", identity.currency],
              ["Datenquelle", identity.provider]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-stroke bg-coal px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-0.5 truncate text-sm text-mist">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <section className="rounded-3xl border border-stroke bg-panel p-5">
          <p className="text-sm text-muted">
            Für <span className="font-mono text-mist">{symbol}</span> liegt kein Eintrag im Instrument
            Master vor. Das Universum wächst suchgetrieben, ist also nicht vollständig — eine Suche
            über den vollständigen Namen kann das Instrument erschließen.
          </p>
        </section>
      )}
    </div>
  );
}

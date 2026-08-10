import { CalendarClock, CircleDollarSign, ExternalLink, GitBranch } from "lucide-react";
import type { CorporateAction, CorporateActionsResult } from "@/lib/corporate-actions";

const actionLabels: Record<CorporateAction["type"], string> = {
  cash_dividend: "Bardividende",
  special_dividend: "Sonderdividende",
  stock_dividend: "Aktiendividende",
  split: "Aktiensplit",
  reverse_split: "Reverse Split",
  symbol_change: "Symboländerung",
  merger: "Fusion",
  spin_off: "Abspaltung",
  rights_issue: "Bezugsrecht",
  delisting: "Delisting"
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : value;
}

function actionValue(action: CorporateAction) {
  if (action.cashAmount !== null) {
    return `${action.cashAmount.toLocaleString("de-DE", { maximumFractionDigits: 8 })} ${action.currency ?? "Währung unbekannt"}`;
  }
  if (action.ratioFrom !== null && action.ratioTo !== null) {
    return `${action.ratioFrom.toLocaleString("de-DE")} : ${action.ratioTo.toLocaleString("de-DE")}`;
  }
  if (action.oldSymbol && action.newSymbol) return `${action.oldSymbol} → ${action.newSymbol}`;
  return "Details vom Anbieter nicht geliefert";
}

export function CorporateActionsPanel({ result }: { result: CorporateActionsResult }) {
  const statusLabel = !result.available
    ? "NICHT VERFÜGBAR"
    : result.partial
      ? "TEILABDECKUNG"
      : "ANBIETERGEMELDET";
  const statusTone = !result.available
    ? "border-loss/30 bg-loss/10 text-loss"
    : result.partial
      ? "border-amber/30 bg-amber/10 text-amber"
      : "border-cyan/30 bg-cyan/10 text-cyan";

  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-cyan" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Corporate Actions</h2>
            <p className="mt-1 text-xs text-muted">Dividenden und Splits mit Ereignisdatum und Herkunft</p>
          </div>
        </div>
        <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide ${statusTone}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 rounded-2xl border border-stroke bg-coal/55 p-3 text-xs leading-5 text-muted">
        <p>{result.note}</p>
        <p className="mt-1">
          Quelle: {result.provider ?? "keine"} · Abruf: {new Date(result.retrievedAt).toLocaleString("de-DE")}
        </p>
        <p className="mt-1">
          Abdeckung: Dividenden {result.coverage.dividends === "available" ? "verfügbar" : "nicht verfügbar"} · Splits {result.coverage.splits === "available" ? "verfügbar" : "nicht verfügbar"}
        </p>
      </div>

      {result.actions.length ? (
        <div className="mt-4 space-y-2">
          {result.actions.slice(0, 12).map((action) => (
            <article key={action.canonicalActionId} className="rounded-2xl border border-stroke bg-coal/55 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {action.type.includes("dividend") ? (
                      <CircleDollarSign className="h-4 w-4 text-profit" aria-hidden="true" />
                    ) : (
                      <GitBranch className="h-4 w-4 text-cyan" aria-hidden="true" />
                    )}
                    <p className="text-sm font-semibold text-mist">{actionLabels[action.type]}</p>
                  </div>
                  <p className="mt-2 font-mono text-base text-mist">{actionValue(action)}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    Ex- / Wirksamkeitsdatum {formatDate(action.effectiveDate)}
                  </p>
                  <p className="mt-1">{action.lifecycle === "scheduled" ? "angekündigt" : "wirksam"}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                {action.announcementDate ? <span>Ankündigung {formatDate(action.announcementDate)}</span> : null}
                {action.recordDate ? <span>Record Date {formatDate(action.recordDate)}</span> : null}
                {action.paymentDate ? <span>Zahlung {formatDate(action.paymentDate)}</span> : null}
                <a
                  className="inline-flex items-center gap-1 text-cyan hover:underline"
                  href={action.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Methodik / Quelle <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-stroke bg-coal/55 p-4 text-sm leading-6 text-muted">
          {result.available
            ? "Der Anbieter meldet für dieses Symbol keine Dividenden oder Splits. Das ist keine Aussage darüber, ob andere Ereignistypen existieren."
            : "Es werden keine Ereignisse geschätzt oder aus Kursbewegungen abgeleitet."}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-4 text-muted">
        Provider-Meldungen werden nicht automatisch als Emittentenbestätigung behandelt. Symboländerungen, Fusionen und Delistings erscheinen erst, wenn dafür eine belastbare Quelle angebunden ist.
      </p>
    </section>
  );
}

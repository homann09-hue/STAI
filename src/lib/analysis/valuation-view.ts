/**
 * Baut aus den Abschlussdaten das, was die Seite anzeigt.
 *
 * Die Trennung ist Absicht: `valuation-data.ts` beschafft, `valuation.ts` und
 * `metric-context.ts` rechnen, und dieses Modul setzt beides zu einer Ansicht
 * zusammen. Damit bleibt die Zusammensetzung ohne Netz prüfbar — und genau
 * dort passieren die Fehler, weil hier Zahlen aus verschiedenen Quellen
 * zusammenkommen.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

import {
  buildMetricContext,
  type MetricContextResult
} from "@/lib/analysis/metric-context";
import {
  comparePeers,
  discountedCashFlow,
  impliedGrowthRate,
  sensitivityAnalysis,
  yieldValuation,
  type DcfResult,
  type PeerComparison,
  type SensitivityAnalysis,
  type YieldValuation
} from "@/lib/analysis/valuation";
import { toDcfAssumptions, type AnalystView, type FundamentalsBundle } from "@/lib/providers/valuation-data";

export type ValuationView = {
  dcf: DcfResult;
  sensitivity: SensitivityAnalysis | null;
  impliedGrowth: { growthRate: number; note: string } | null;
  yields: YieldValuation;
  metrics: MetricContextResult[];
  peers: PeerComparison[];
  analysts: AnalystView | null;
  note: string;
};

/**
 * Setzt die Ansicht zusammen.
 *
 * `riskFreeRate` kommt von außen, weil sie aus einer **anderen** Quelle stammt
 * (FRED, 10-Jahres-Rendite). Sie hier fest einzutragen wäre bequem und würde
 * bei jeder Zinsänderung stillschweigend falsch.
 */
export function buildValuationView(
  bundle: FundamentalsBundle,
  options: { riskFreeRate?: number | null; currency?: string } = {}
): ValuationView {
  const currency = options.currency ?? "$";
  const assumptions = toDcfAssumptions(bundle.valuation);

  const dcf: DcfResult = assumptions
    ? discountedCashFlow(assumptions)
    : {
        ok: false,
        reason:
          bundle.valuation.blockers.length > 0
            ? bundle.valuation.blockers.join(" ")
            : "Für eine Bewertung fehlen Eingangsdaten."
      };

  const history = bundle.ratios;
  const metricsHistory = bundle.keyMetrics;

  // Der jeweils jüngste Wert steht an Position 0 -- der Anbieter liefert
  // absteigend nach Geschäftsjahr.
  const metrics = [
    buildMetricContext("peRatio", history[0]?.peRatio, history.map((year) => year.peRatio), currency),
    buildMetricContext("priceToSales", history[0]?.priceToSales, history.map((year) => year.priceToSales), currency),
    buildMetricContext("priceToBook", history[0]?.priceToBook, history.map((year) => year.priceToBook), currency),
    buildMetricContext("grossMargin", history[0]?.grossMargin, history.map((year) => year.grossMargin), currency),
    buildMetricContext("netMargin", history[0]?.netMargin, history.map((year) => year.netMargin), currency),
    buildMetricContext("debtToEquity", history[0]?.debtToEquity, history.map((year) => year.debtToEquity), currency),
    buildMetricContext(
      "returnOnEquity",
      metricsHistory[0]?.returnOnEquity,
      metricsHistory.map((year) => year.returnOnEquity),
      currency
    ),
    buildMetricContext(
      "earningsYield",
      metricsHistory[0]?.earningsYield,
      metricsHistory.map((year) => year.earningsYield),
      currency
    )
  ].filter((entry): entry is MetricContextResult => entry !== null);

  // Peers ohne eigene Kennzahlen: der Anbieter liefert zur Vergleichsgruppe nur
  // Kurs und Marktkapitalisierung. Ein Bewertungsvergleich braucht deren
  // Kennzahlen und ist damit im Tarif nicht bildbar -- statt zu schaetzen
  // bleibt die Liste als Liste stehen.
  const peers: PeerComparison[] = bundle.peers.length
    ? [
        comparePeers(
          "Marktkapitalisierung (Mrd.)",
          null,
          bundle.peers.map((peer) => ({
            symbol: peer.symbol,
            name: peer.name,
            value: peer.marketCap === null ? null : peer.marketCap / 1_000_000_000
          }))
        )
      ]
    : [];

  return {
    dcf,
    sensitivity: assumptions ? sensitivityAnalysis(assumptions) : null,
    impliedGrowth: null,
    yields: yieldValuation({
      earningsYield: bundle.valuation.earningsYield,
      freeCashFlowYield: bundle.valuation.freeCashFlowYield,
      riskFreeRate: options.riskFreeRate ?? null
    }),
    metrics,
    peers,
    analysts: bundle.analysts,
    note: bundle.note
  };
}

/**
 * Ergänzt das implizite Wachstum.
 *
 * Getrennt, weil dafür der **aktuelle Kurs** nötig ist — und der ist auf der
 * Seite eine andere Größe als die Abschlussdaten. Sie zusammenzuwerfen war
 * schon einmal die Ursache eines Vorzeichenfehlers um eine Größenordnung.
 */
export function withImpliedGrowth(view: ValuationView, bundle: FundamentalsBundle, price: number | null): ValuationView {
  const assumptions = toDcfAssumptions(bundle.valuation);
  if (!assumptions || price === null || price <= 0) return view;

  // Das Wachstum ist genau die gesuchte Groesse und wird deshalb nicht
  // uebergeben -- der Reverse DCF loest danach auf.
  const base = {
    freeCashFlow: assumptions.freeCashFlow,
    sharesOutstanding: assumptions.sharesOutstanding,
    netDebt: assumptions.netDebt,
    terminalGrowth: assumptions.terminalGrowth,
    discountRate: assumptions.discountRate,
    years: assumptions.years
  };

  return { ...view, impliedGrowth: impliedGrowthRate(base, price) };
}

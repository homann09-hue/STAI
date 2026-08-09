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
  type PeerMetricDirection,
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

  // §36: der eigentliche Vergleich mit der Wettbewerbsgruppe.
  //
  // Eine frühere Fassung zeigte nur Marktkapitalisierungen, weil ich annahm,
  // der Tarif liefere zu Peers keine Kennzahlen. Nachgemessen war das falsch:
  // einzeln abgerufen antwortet `ratios` je Symbol mit 200, nur der
  // Sammelabruf über eine Kommaliste ist gesperrt.
  //
  // Verglichen wird über Bewertung, Marge, Verschuldung und Kapitalrendite —
  // die Achsen, auf denen ein Aufschlag begründet sein muss.
  const withMetrics = bundle.peers.filter((peer) => peer.metrics !== null);

  const peerRow = (
    label: string,
    own: number | null,
    pick: (metrics: NonNullable<(typeof bundle.peers)[number]["metrics"]>) => number | null,
    // Ohne diese Angabe bekaeme jede Kennzahl die Sprache eines
    // Bewertungsvielfachen -- und ein hoher Verschuldungsgrad erschiene als
    // "Aufschlag, der durch Wachstum gedeckt sein muss".
    direction: PeerMetricDirection = "valuation"
  ) =>
    comparePeers(
      label,
      own,
      withMetrics.map((peer) => ({
        symbol: peer.symbol,
        name: peer.name,
        value: peer.metrics ? pick(peer.metrics) : null
      })),
      direction
    );

  const peers: PeerComparison[] = withMetrics.length
    ? [
        peerRow("KGV", history[0]?.peRatio ?? null, (metrics) => metrics.peRatio),
        peerRow("Kurs-Umsatz-Verhältnis", history[0]?.priceToSales ?? null, (metrics) => metrics.priceToSales),
        // Margen und Renditen in Prozent, damit die Zahlen lesbar bleiben.
        peerRow(
          "Bruttomarge in %",
          history[0]?.grossMargin == null ? null : history[0].grossMargin * 100,
          (metrics) => (metrics.grossMargin === null ? null : metrics.grossMargin * 100),
          "higher_is_better"
        ),
        peerRow(
          "Nettomarge in %",
          history[0]?.netMargin == null ? null : history[0].netMargin * 100,
          (metrics) => (metrics.netMargin === null ? null : metrics.netMargin * 100),
          "higher_is_better"
        ),
        peerRow("Verschuldungsgrad", history[0]?.debtToEquity ?? null, (metrics) => metrics.debtToEquity, "lower_is_better"),
        peerRow(
          "Kapitalrendite (ROIC) in %",
          // Stand zuvor auf `null` -- die eigene ROIC wurde gar nicht gelesen.
          metricsHistory[0]?.returnOnInvestedCapital == null
            ? null
            : metricsHistory[0].returnOnInvestedCapital * 100,
          (metrics) => (metrics.returnOnInvestedCapital === null ? null : metrics.returnOnInvestedCapital * 100),
          "higher_is_better"
        )
      ]
    : bundle.peers.length
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

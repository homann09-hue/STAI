/**
 * Abschlussdaten für Bewertung, Kennzahlen und Peer-Vergleich.
 *
 * Bewusst **neben** `fundamentals-provider.ts` und nicht darin: jener liefert
 * die sieben Kennzahlen des `Fundamentals`-Typs für die Übersicht, dieser die
 * Mehrjahresreihen und Bilanzgrößen für DCF, historische Einordnung und
 * Peer-Vergleich. Zwei Aufgaben, zwei Module — ich hatte den bestehenden beim
 * ersten Versuch versehentlich überschrieben.
 *
 * Bündelt, was §37 (Bewertung), §50 (historische Einordnung) und §36 (Peers)
 * an Zahlen brauchen — und trennt dabei strikt Auswertung von Abruf, damit die
 * Auswertung ohne Schlüssel prüfbar bleibt.
 *
 * **Die Nettoverschuldung kommt aus der Bilanz.** Das ist keine Kleinigkeit:
 * bei einer früheren Probe hatte ich sie als `enterpriseValue − marketCap`
 * abgeleitet und erhielt für Apple 707 Mrd. $ Nettoliquidität. Tatsächlich sind
 * es **76,4 Mrd. $ Nettoschulden**. Ursache war das Vermischen von Stichtagen —
 * der Unternehmenswert stammte aus dem Geschäftsjahr, die
 * Marktkapitalisierung von heute. §22 verbietet genau das.
 *
 * Gemessen am 2026-08-08: der Tarif liefert höchstens fünf Geschäftsjahre
 * (`limit=6` antwortet mit HTTP 402).
 */

import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import type { DcfAssumptions } from "@/lib/analysis/valuation";

const FMP_HOST = "financialmodelingprep.com";

/** Mehr gibt der Tarif nicht her — und mehr wird deshalb nicht angefragt. */
export const MAX_FISCAL_YEARS = 5;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type RatioYear = {
  fiscalYear: string | null;
  peRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
};

/**
 * Wertet die Kennzahlenreihe aus.
 *
 * Rein, damit die Zuordnung der Feldnamen ohne Netz prüfbar bleibt — genau
 * dort passieren die stillen Fehler: `priceToEarningsRatio` gegen
 * `priceToEarningsDilutedRatio` sind zwei verschiedene Zahlen mit fast
 * gleichem Namen.
 */
export function parseRatioHistory(raw: unknown): RatioYear[] {
  const rows = Array.isArray(raw) ? raw : [];

  return rows.flatMap((row): RatioYear[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;

    return [
      {
        fiscalYear: typeof entry.fiscalYear === "string" ? entry.fiscalYear : null,
        peRatio: num(entry.priceToEarningsRatio),
        priceToSales: num(entry.priceToSalesRatio),
        priceToBook: num(entry.priceToBookRatio),
        grossMargin: num(entry.grossProfitMargin),
        netMargin: num(entry.netProfitMargin),
        debtToEquity: num(entry.debtToEquityRatio)
      }
    ];
  });
}

export type KeyMetricsYear = {
  fiscalYear: string | null;
  returnOnEquity: number | null;
  /** §36 verlangt ROIC ausdrücklich. Das Feld fehlte hier zunächst ganz. */
  returnOnInvestedCapital: number | null;
  earningsYield: number | null;
  freeCashFlowYield: number | null;
  enterpriseValue: number | null;
};

export function parseKeyMetrics(raw: unknown): KeyMetricsYear[] {
  const rows = Array.isArray(raw) ? raw : [];

  return rows.flatMap((row): KeyMetricsYear[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;

    return [
      {
        fiscalYear: typeof entry.fiscalYear === "string" ? entry.fiscalYear : null,
        // Die Eigenkapitalrendite steht hier und **nicht** in `ratios` -- dort
        // ist das Feld im Tarif durchgehend 0. Ein Wert von 0 % waere eine
        // Aussage, keine Luecke, deshalb wird die andere Quelle genutzt.
        returnOnEquity: num(entry.returnOnEquity),
        returnOnInvestedCapital: num(entry.returnOnInvestedCapital),
        earningsYield: num(entry.earningsYield),
        freeCashFlowYield: num(entry.freeCashFlowYield),
        enterpriseValue: num(entry.enterpriseValue)
      }
    ];
  });
}

export type ValuationInputs = {
  freeCashFlow: number | null;
  /** Aus der **Bilanz**, nicht aus einer Differenz zweier Zeitstände. */
  netDebt: number | null;
  sharesOutstanding: number | null;
  earningsYield: number | null;
  freeCashFlowYield: number | null;
  /** Warum eine Bewertung nicht möglich ist — leer, wenn sie möglich ist. */
  blockers: string[];
};

/**
 * Sammelt die Eingaben für den DCF.
 *
 * Die Aktienzahl wird aus Marktkapitalisierung und Kurs gebildet. Beide
 * stammen aus **derselben** Kursabfrage, sind also gleich datiert — der
 * Fehler, der bei der Nettoverschuldung passiert war, kann hier nicht
 * auftreten.
 */
export function buildValuationInputs(input: {
  freeCashFlow: number | null;
  netDebt: number | null;
  marketCap: number | null;
  price: number | null;
  earningsYield: number | null;
  freeCashFlowYield: number | null;
}): ValuationInputs {
  const sharesOutstanding =
    input.marketCap !== null && input.price !== null && input.price > 0
      ? input.marketCap / input.price
      : null;

  const blockers: string[] = [];
  if (input.freeCashFlow === null) blockers.push("Kein freier Cashflow gemeldet.");
  else if (input.freeCashFlow <= 0) blockers.push("Der freie Cashflow ist negativ oder null.");
  if (sharesOutstanding === null) blockers.push("Aktienzahl nicht bestimmbar.");
  if (input.netDebt === null) blockers.push("Nettoverschuldung liegt nicht vor.");

  return {
    freeCashFlow: input.freeCashFlow,
    netDebt: input.netDebt,
    sharesOutstanding,
    earningsYield: input.earningsYield,
    freeCashFlowYield: input.freeCashFlowYield,
    blockers
  };
}

/**
 * Standardannahmen für den DCF.
 *
 * Ausdrücklich **Annahmen** und keine Prognose. Sie stehen hier an einer
 * Stelle, damit sie sichtbar und änderbar sind statt im Aufruf verstreut —
 * §37 verlangt, dass sie mit ausgegeben werden.
 *
 * 9 % Diskontsatz liegt bei der langjährigen Aktienmarktrendite, 2,5 % ewiges
 * Wachstum etwa beim Inflationsziel plus einem kleinen Realanteil. Beides ist
 * grob und soll grob sein — die Sensitivitätsrechnung zeigt ohnehin die
 * Spanne.
 */
export const defaultDcfAssumptions = {
  growthRate: 0.08,
  terminalGrowth: 0.025,
  discountRate: 0.09,
  years: 5
} as const;

export function toDcfAssumptions(inputs: ValuationInputs): DcfAssumptions | null {
  if (inputs.freeCashFlow === null || inputs.sharesOutstanding === null || inputs.netDebt === null) {
    return null;
  }

  return {
    freeCashFlow: inputs.freeCashFlow,
    sharesOutstanding: inputs.sharesOutstanding,
    netDebt: inputs.netDebt,
    ...defaultDcfAssumptions
  };
}

export type PeerEntry = {
  symbol: string;
  name: string;
  marketCap: number | null;
  price: number | null;
  /** Kennzahlen des Peers. `null`, solange sie nicht geladen wurden. */
  metrics: PeerMetrics | null;
};

export type PeerMetrics = {
  peRatio: number | null;
  priceToSales: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  returnOnEquity: number | null;
  returnOnInvestedCapital: number | null;
};

export function parsePeers(raw: unknown): PeerEntry[] {
  const rows = Array.isArray(raw) ? raw : [];

  return rows.flatMap((row): PeerEntry[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;
    const symbol = typeof entry.symbol === "string" ? entry.symbol.trim() : "";
    if (!symbol) return [];

    return [
      {
        symbol,
        name: typeof entry.companyName === "string" ? entry.companyName : symbol,
        marketCap: num(entry.mktCap),
        price: num(entry.price),
        metrics: null
      }
    ];
  });
}

/** Wertet Kennzahlen und Renditen eines Peers aus. Rein. */
export function parsePeerMetrics(ratiosRaw: unknown, keyMetricsRaw: unknown): PeerMetrics | null {
  const ratio = Array.isArray(ratiosRaw) ? (ratiosRaw[0] as Record<string, unknown> | undefined) : undefined;
  const metric = Array.isArray(keyMetricsRaw) ? (keyMetricsRaw[0] as Record<string, unknown> | undefined) : undefined;
  if (!ratio && !metric) return null;

  return {
    peRatio: num(ratio?.priceToEarningsRatio),
    priceToSales: num(ratio?.priceToSalesRatio),
    grossMargin: num(ratio?.grossProfitMargin),
    netMargin: num(ratio?.netProfitMargin),
    debtToEquity: num(ratio?.debtToEquityRatio),
    // Beide kommen aus `key-metrics`: in `ratios` steht die
    // Eigenkapitalrendite im Tarif durchgehend auf 0.
    returnOnEquity: num(metric?.returnOnEquity),
    returnOnInvestedCapital: num(metric?.returnOnInvestedCapital)
  };
}

/**
 * Wie viele Peers Kennzahlen bekommen.
 *
 * Jeder kostet **zwei** Abrufe, weil der Sammelabruf über eine Kommaliste mit
 * HTTP 402 antwortet. Fünf Peers sind zehn Anfragen — genug für einen Median
 * und wenig genug, um den Seitenaufbau nicht zu verschleppen.
 */
export const MAX_PEERS_WITH_METRICS = 5;

export type AnalystView = {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: string | null;
  /** Kursziele je Zeitraum. `null`, wenn keine Schätzung vorliegt. */
  targets: { lastMonth: number | null; lastQuarter: number | null; lastYear: number | null };
  /** Wie viele Häuser je Zeitraum eingeflossen sind. */
  counts: { lastMonth: number; lastQuarter: number; lastYear: number };
  note: string;
};

/**
 * Analystenurteile und Kursziele (§33).
 *
 * Die Zeiträume werden **getrennt** ausgewiesen statt zu einem Wert
 * zusammengefasst. Der Grund ist die eigentliche Aussage: bei Apple lag das
 * Durchschnittsziel des letzten Monats am 2026-08-08 bei 329,55 $, das des
 * letzten Jahres bei 306,68 $. Die Veränderung über die Zeit ist die
 * Information — ein Mittelwert über alles hätte sie gelöscht.
 */
export function parseAnalystView(consensusRaw: unknown, targetsRaw: unknown): AnalystView | null {
  const consensusRow = Array.isArray(consensusRaw) ? consensusRaw[0] : null;
  const targetRow = Array.isArray(targetsRaw) ? targetsRaw[0] : null;
  if (!consensusRow && !targetRow) return null;

  const c = (consensusRow ?? {}) as Record<string, unknown>;
  const t = (targetRow ?? {}) as Record<string, unknown>;

  const count = (value: unknown) => num(value) ?? 0;
  const ratings = {
    strongBuy: count(c.strongBuy),
    buy: count(c.buy),
    hold: count(c.hold),
    sell: count(c.sell),
    strongSell: count(c.strongSell)
  };
  const total = Object.values(ratings).reduce((sum, value) => sum + value, 0);

  const targets = {
    lastMonth: num(t.lastMonthAvgPriceTarget),
    lastQuarter: num(t.lastQuarterAvgPriceTarget),
    lastYear: num(t.lastYearAvgPriceTarget)
  };

  const drift =
    targets.lastMonth !== null && targets.lastYear !== null && targets.lastYear !== 0
      ? ((targets.lastMonth - targets.lastYear) / targets.lastYear) * 100
      : null;

  return {
    ...ratings,
    consensus: typeof c.consensus === "string" ? c.consensus : null,
    targets,
    counts: {
      lastMonth: count(t.lastMonthCount),
      lastQuarter: count(t.lastQuarterCount),
      lastYear: count(t.lastYearCount)
    },
    note:
      total === 0
        ? "Keine Analystenurteile verfügbar."
        : drift === null
          ? `${total} Urteile. Für einen Vergleich der Kursziele über die Zeit fehlen Daten.`
          : `${total} Urteile. Das Durchschnittsziel des letzten Monats liegt ${drift >= 0 ? "" : "−"}${Math.abs(drift).toFixed(0)} % ${drift >= 0 ? "über" : "unter"} dem des letzten Jahres. Kursziele folgen dem Kurs oft, statt ihn vorwegzunehmen.`
  };
}

async function fmp<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const token = process.env.FMP_API_KEY;
  if (!token) return null;

  const base = process.env.FMP_API_BASE_URL ?? `https://${FMP_HOST}/stable`;
  const url = new URL(`${base}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("apikey", token);

  try {
    const { data } = await fetchBoundedProviderJson<T>(url, "FMP Fundamentals", { timeoutMs: 8000 });
    return data;
  } catch {
    // Eine fehlende Kennzahl darf keinen Analysepfad abbrechen -- sie darf aber
    // auch nicht ersetzt werden.
    return null;
  }
}

export type FundamentalsBundle = {
  ratios: RatioYear[];
  keyMetrics: KeyMetricsYear[];
  valuation: ValuationInputs;
  peers: PeerEntry[];
  analysts: AnalystView | null;
  note: string;
};

export async function fetchFundamentals(
  symbol: string,
  quote: { marketCap: number | null; price: number | null }
): Promise<FundamentalsBundle | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;

  const years = String(MAX_FISCAL_YEARS);
  const [ratiosRaw, metricsRaw, cashRaw, balanceRaw, peersRaw, consensusRaw, targetsRaw] = await Promise.all([
    fmp<unknown>("ratios", { symbol: normalized, limit: years }),
    fmp<unknown>("key-metrics", { symbol: normalized, limit: years }),
    fmp<unknown>("cash-flow-statement", { symbol: normalized, limit: "1" }),
    fmp<unknown>("balance-sheet-statement", { symbol: normalized, limit: "1" }),
    fmp<unknown>("stock-peers", { symbol: normalized }),
    fmp<unknown>("grades-consensus", { symbol: normalized }),
    fmp<unknown>("price-target-summary", { symbol: normalized })
  ]);

  const ratios = parseRatioHistory(ratiosRaw);
  const keyMetrics = parseKeyMetrics(metricsRaw);
  const peers = parsePeers(peersRaw);

  // Kennzahlen der Vergleichsgruppe nachladen. Der Sammelabruf ueber eine
  // Kommaliste antwortet mit HTTP 402, also bleibt nur einzeln -- und deshalb
  // gedeckelt.
  const peersWithMetrics = await Promise.all(
    peers.slice(0, MAX_PEERS_WITH_METRICS).map(async (peer) => {
      const [peerRatios, peerMetrics] = await Promise.all([
        fmp<unknown>("ratios", { symbol: peer.symbol, limit: "1" }),
        fmp<unknown>("key-metrics", { symbol: peer.symbol, limit: "1" })
      ]);

      return { ...peer, metrics: parsePeerMetrics(peerRatios, peerMetrics) };
    })
  );
  const cash = Array.isArray(cashRaw) ? (cashRaw[0] as Record<string, unknown> | undefined) : undefined;
  const balance = Array.isArray(balanceRaw) ? (balanceRaw[0] as Record<string, unknown> | undefined) : undefined;

  if (ratios.length === 0 && keyMetrics.length === 0 && !cash && !balance) return null;

  return {
    ratios,
    keyMetrics,
    valuation: buildValuationInputs({
      freeCashFlow: num(cash?.freeCashFlow),
      netDebt: num(balance?.netDebt),
      marketCap: quote.marketCap,
      price: quote.price,
      earningsYield: keyMetrics[0]?.earningsYield ?? null,
      freeCashFlowYield: keyMetrics[0]?.freeCashFlowYield ?? null
    }),
    // Peers ohne Kennzahlen bleiben in der Liste: sie gehoeren zur
    // Vergleichsgruppe, auch wenn ihre Zahlen nicht geladen wurden.
    peers: [...peersWithMetrics, ...peers.slice(MAX_PEERS_WITH_METRICS)],
    analysts: parseAnalystView(consensusRaw, targetsRaw),
    note: `Abschlussdaten aus bis zu ${MAX_FISCAL_YEARS} Geschäftsjahren. Financial Modeling Prep.`
  };
}

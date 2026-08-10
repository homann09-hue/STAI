import type { AssetSummary, DashboardData, NewsItem, RiskWarning } from "@/lib/types";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      maximumFractionDigits: value >= 100 ? 2 : 4
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function buildVerifiedProviderDashboard(
  summaries: AssetSummary[],
  providerName: string,
  latestNews: NewsItem[] = []
): DashboardData {
  const verified = summaries.filter(
    (item) => item.quote.quality !== "mock" && item.quote.quality !== "unavailable"
  );
  const gainers = verified
    .filter((item) => item.quote.changePercent > 0)
    .sort((a, b) => b.quote.changePercent - a.quote.changePercent)
    .slice(0, 10);
  const losers = verified
    .filter((item) => item.quote.changePercent < 0)
    .sort((a, b) => a.quote.changePercent - b.quote.changePercent)
    .slice(0, 10);
  const mostActive = [...verified].sort((a, b) => b.quote.volume - a.quote.volume).slice(0, 10);
  const trendingAssets = [...verified]
    .sort((a, b) => Math.abs(b.quote.changePercent) - Math.abs(a.quote.changePercent))
    .slice(0, 10);
  const averageMove = average(verified.map((item) => item.quote.changePercent));
  const positive = verified.filter((item) => item.quote.changePercent > 0).length;
  const breadth = verified.length ? (positive / verified.length) * 100 : 0;
  const now = Date.now();
  const staleSources = verified.filter((item) => {
    const ageMs = now - new Date(item.quote.asOf).getTime();
    const threshold = item.quote.quality === "delayed" ? 45 * 60_000 : 10 * 60_000;
    return !Number.isFinite(ageMs) || ageMs > threshold;
  }).length;
  const riskWarnings: RiskWarning[] = verified
    .filter((item) => Math.abs(item.quote.changePercent) >= 5)
    .slice(0, 6)
    .map((item) => ({
      id: `market-move-${item.asset.symbol}`,
      symbol: item.asset.symbol,
      title: "Ungewoehnlich starke Tagesbewegung",
      severity: Math.abs(item.quote.changePercent) >= 10 ? "extrem" : "hoch",
      detail: `${item.asset.symbol} bewegt sich ${item.quote.changePercent.toFixed(2)} %. Ursache und Liquiditaet vor einer Interpretation pruefen.`
    }));

  const marketDirection =
    verified.length === 0
      ? "Keine verifizierten Kurse"
      : averageMove > 0.35
        ? "Breit positiv"
        : averageMove < -0.35
          ? "Breit negativ"
          : "Uneinheitlich";

  return {
    // Eine Nutzer-Watchlist darf nicht aus einer Anbieter-Seedliste erfunden
    // werden. Sie wird separat aus Nutzer- bzw. Offline-Daten geladen.
    watchlist: [],
    gainers,
    losers,
    mostActive,
    trendingAssets,
    marketOverview: verified.slice(0, 8).map((item) => ({
      label: item.asset.symbol,
      value: formatPrice(item.quote.price, item.asset.currency),
      changePercent: item.quote.changePercent,
      status:
        item.quote.marketStatus === "open"
          ? Math.abs(item.quote.changePercent) >= 4
            ? "volatile"
            : "open"
          : "closed"
    })),
    trends:
      verified.length > 0
        ? [
            `${positive} von ${verified.length} verifizierten Instrumenten liegen im Plus.`,
            `Mittlere Tagesbewegung: ${averageMove.toFixed(2)} %.`,
            staleSources > 0
              ? `${staleSources} Quelle(n) ueberschreiten die Frischegrenze.`
              : "Alle angezeigten Quellen liegen innerhalb ihrer Frischegrenze."
          ]
        : ["Keine verifizierten Providerkurse verfuegbar. Es werden keine Ersatzkurse erzeugt."],
    dataQualitySummary: {
      label: verified.length ? `${providerName}, ${verified.length} verifizierte Kurse` : "Keine verifizierten Kurse",
      score: verified.length ? Math.max(0, Math.round(100 - (staleSources / verified.length) * 100)) : 0,
      staleSources,
      mockSources: 0
    },
    aiSentiment: {
      label: marketDirection,
      score: verified.length ? Math.max(0, Math.min(100, Math.round(50 + averageMove * 8))) : 0,
      summary:
        verified.length > 0
          ? `Deterministische Marktbreite aus ${verified.length} Providerkursen. Keine Renditeprognose.`
          : "Ohne verifizierte Kurse wird kein Markt-Sentiment berechnet."
    },
    signalSummary: {
      fundamental: "Nicht universumsweit verfuegbar",
      technical: verified.length ? `${positive}/${verified.length} Tagesbewegungen positiv` : "Nicht berechenbar",
      momentum: verified.length ? `Mittlere Bewegung ${averageMove.toFixed(2)} %` : "Nicht berechenbar",
      sentiment: marketDirection,
      valuation: "Nicht universumsweit verfuegbar",
      macro: "Separates Makromodul erforderlich",
      risk: riskWarnings.length ? `${riskWarnings.length} starke Marktbewegung(en)` : "Keine Schwellenverletzung im Trefferfenster",
      overall: marketDirection,
      rationale: verified.length
        ? "Nur aus aktuellen normalisierten Providerkursen abgeleitet; fehlende Fundamentaldaten werden nicht ersetzt."
        : "Keine Auswertung ohne verifizierte Eingangsdaten."
    },
    marketDashboard: [
      {
        label: "Verifizierte Kurse",
        value: String(verified.length),
        detail: providerName,
        status: verified.length ? "positive" : "warning"
      },
      {
        label: "Marktbreite",
        value: verified.length ? `${breadth.toFixed(0)} % positiv` : "n/a",
        detail: "Anteil positiver Tagesveraenderungen im geladenen Trefferfenster",
        status: breadth >= 55 ? "positive" : breadth <= 45 ? "negative" : "neutral"
      },
      {
        label: "Datenfrische",
        value: staleSources ? `${staleSources} veraltet` : verified.length ? "im Rahmen" : "n/a",
        detail: "Frischegrenze ist von der ausgewiesenen Datenqualitaet abhaengig.",
        status: staleSources ? "warning" : verified.length ? "positive" : "neutral"
      }
    ],
    riskWarnings,
    latestNews: latestNews.filter((item) => !item.source.toLowerCase().includes("mock")).slice(0, 12)
  };
}

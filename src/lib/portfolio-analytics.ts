import type {
  AllocationSlice,
  PortfolioPosition,
  PortfolioSummary,
  PortfolioTradeInput,
  PortfolioWarning,
  RiskLevel
} from "@/lib/types";

function weightTone(weight: number): RiskLevel {
  if (weight >= 45) return "hoch";
  if (weight >= 30) return "mittel";
  return "niedrig";
}

function finiteNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizePosition(position: PortfolioPosition): PortfolioPosition | null {
  const quantity = finiteNumber(position.quantity);
  const averagePrice = finiteNumber(position.averagePrice);
  const currentPrice = finiteNumber(position.currentPrice);
  const riskScore = Math.max(0, Math.min(100, finiteNumber(position.riskScore, 55)));

  if (quantity <= 0 || averagePrice < 0 || currentPrice < 0) return null;

  return {
    ...position,
    quantity,
    averagePrice,
    currentPrice,
    riskScore
  };
}

function allocations(positions: PortfolioPosition[], totalValue: number, key: "sector" | "assetType") {
  const grouped = new Map<string, number>();

  for (const position of positions) {
    const value = position.quantity * position.currentPrice;
    const label = position[key];
    grouped.set(label, (grouped.get(label) ?? 0) + value);
  }

  return [...grouped.entries()]
    .map<AllocationSlice>(([label, value]) => ({
      label,
      value,
      weight: totalValue ? (value / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.weight - a.weight);
}

export function analyzePortfolio(positions: PortfolioPosition[]): PortfolioSummary {
  const activePositions = positions
    .map(sanitizePosition)
    .filter((position): position is PortfolioPosition => Boolean(position));
  const totalValue = activePositions.reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
  const totalCost = activePositions.reduce((sum, item) => sum + item.quantity * item.averagePrice, 0);
  const totalRisk = totalValue
    ? activePositions.reduce((sum, item) => sum + ((item.quantity * item.currentPrice) / totalValue) * item.riskScore, 0)
    : 0;
  const maxPositionWeight = totalValue
    ? Math.max(...activePositions.map((item) => ((item.quantity * item.currentPrice) / totalValue) * 100), 0)
    : 0;
  const sectorAllocation = allocations(activePositions, totalValue, "sector");
  const assetAllocation = allocations(activePositions, totalValue, "assetType");
  const cryptoWeight = assetAllocation.find((item) => item.label === "crypto")?.weight ?? 0;
  const diversificationScore = Math.round(
    Math.max(0, Math.min(100, 100 - maxPositionWeight * 0.8 - Math.max(0, cryptoWeight - 20) * 0.7))
  );
  const warnings: PortfolioWarning[] = [];

  if (maxPositionWeight > 35) {
    warnings.push({
      id: "concentration",
      severity: weightTone(maxPositionWeight),
      title: "Klumpenrisiko",
      detail: `Größte Position hat ${maxPositionWeight.toFixed(1)}% Gewichtung.`
    });
  }

  if (cryptoWeight > 25) {
    warnings.push({
      id: "crypto-weight",
      severity: cryptoWeight > 40 ? "hoch" : "mittel",
      title: "Hohe Krypto-Gewichtung",
      detail: `Krypto-Anteil liegt bei ${cryptoWeight.toFixed(1)}%.`
    });
  }

  if (totalRisk > 65) {
    warnings.push({
      id: "portfolio-risk",
      severity: totalRisk > 80 ? "hoch" : "mittel",
      title: "Gesamtportfolio-Risiko erhöht",
      detail: `Gewichtetes Risiko liegt bei ${Math.round(totalRisk)}/100.`
    });
  }

  if (diversificationScore < 55) {
    warnings.push({
      id: "diversification",
      severity: diversificationScore < 35 ? "hoch" : "mittel",
      title: "Diversifikation schwach",
      detail: `Diversifikationsscore liegt bei ${diversificationScore}/100.`
    });
  }

  return {
    positions: activePositions,
    totalValue,
    totalCost,
    totalPnL: totalValue - totalCost,
    totalPnLPercent: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    totalRisk: Math.round(totalRisk),
    diversificationScore,
    maxPositionWeight,
    cryptoWeight,
    sectorAllocation,
    assetAllocation,
    scenarios: [-20, -10, -5, 10, 20].map((shockPercent) => {
      const estimatedValue = totalValue * (1 + shockPercent / 100);
      return {
        label: `${shockPercent > 0 ? "+" : ""}${shockPercent}%`,
        shockPercent,
        estimatedValue,
        estimatedPnL: estimatedValue - totalCost
      };
    }),
    warnings
  };
}

export function applyPortfolioTrade(positions: PortfolioPosition[], trade: PortfolioTradeInput) {
  const existing = positions.find((position) => position.symbol === trade.symbol);

  if (!existing && trade.side === "sell") {
    return positions;
  }

  if (!existing) {
    return [
      ...positions,
      {
        id: `local-${Date.now()}`,
        symbol: trade.symbol,
        name: trade.name ?? `${trade.symbol} Position`,
        assetType: trade.assetType,
        sector: trade.sector,
        quantity: trade.quantity,
        averagePrice: trade.price,
        currentPrice: trade.price,
        currency: trade.currency,
        riskScore: trade.riskScore
      }
    ];
  }

  return positions
    .map((position) => {
      if (position.symbol !== trade.symbol) return position;

      if (trade.side === "sell") {
        return {
          ...position,
          quantity: Math.max(0, position.quantity - trade.quantity)
        };
      }

      const newQuantity = position.quantity + trade.quantity;
      const newCost = position.averagePrice * position.quantity + trade.price * trade.quantity;

      return {
        ...position,
        quantity: newQuantity,
        averagePrice: newCost / newQuantity,
        currentPrice: trade.price,
        riskScore: trade.riskScore,
        sector: trade.sector,
        assetType: trade.assetType
      };
    })
    .filter((position) => position.quantity > 0);
}

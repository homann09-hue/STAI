"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ScenarioTable } from "@/components/analysis-panels";
import { OFFLINE_KEYS, saveOfflineValue } from "@/lib/offline";
import { analyzePortfolio, applyPortfolioTrade } from "@/lib/portfolio-analytics";
import { formatCurrency, formatPercent, legalDisclaimer, riskTone } from "@/lib/scoring";
import type { AssetType, PortfolioSummary } from "@/lib/types";

export function PortfolioView({ initialPortfolio }: { initialPortfolio: PortfolioSummary }) {
  const [positions, setPositions] = useState(initialPortfolio.positions);
  const [symbol, setSymbol] = useState("MSFT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [sector, setSector] = useState("Software / Cloud");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("500");
  const [riskScore, setRiskScore] = useState("55");
  const portfolio = useMemo(() => analyzePortfolio(positions), [positions]);
  const positive = portfolio.totalPnL >= 0;

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.portfolio, positions);
  }, [positions]);

  function submitTrade() {
    const qty = Number(quantity);
    const avg = Number(price);
    const risk = Number(riskScore);
    if (
      !symbol.trim() ||
      !sector.trim() ||
      Number.isNaN(qty) ||
      Number.isNaN(avg) ||
      Number.isNaN(risk) ||
      qty <= 0 ||
      avg <= 0 ||
      risk < 0 ||
      risk > 100
    ) {
      return;
    }

    setPositions((current) =>
      applyPortfolioTrade(current, {
        symbol: symbol.trim().toUpperCase(),
        side,
        assetType,
        sector,
        quantity: qty,
        price: avg,
        currency: "USD",
        riskScore: risk
      })
    );
    setQuantity("1");
    setPrice("500");
  }

  return (
    <div className="space-y-7">
      <section className="rounded-md border border-stroke bg-[linear-gradient(140deg,#101712,#07100d_70%,#172114)] p-5 shadow-panel">
        <p className="text-sm text-muted">Portfolio</p>
        <h1 className="mt-2 text-3xl font-semibold">Positionen und Risiko</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-md bg-ink/40 p-3">
            <p className="text-xs text-muted">Wert</p>
            <p className="mt-1 font-mono text-xl font-semibold">{formatCurrency(portfolio.totalValue)}</p>
          </div>
          <div className="rounded-md bg-ink/40 p-3">
            <p className="text-xs text-muted">Gewinn / Verlust</p>
            <p className={`mt-1 font-mono text-xl font-semibold ${positive ? "text-profit" : "text-loss"}`}>
              {formatCurrency(portfolio.totalPnL)}
            </p>
          </div>
          <div className="rounded-md bg-ink/40 p-3">
            <p className="text-xs text-muted">Performance</p>
            <p className={`mt-1 font-mono text-xl font-semibold ${positive ? "text-profit" : "text-loss"}`}>
              {formatPercent(portfolio.totalPnLPercent)}
            </p>
          </div>
          <div className="rounded-md bg-ink/40 p-3">
            <p className="text-xs text-muted">Gesamtrisiko</p>
            <p className="mt-1 font-mono text-xl font-semibold text-amber">{portfolio.totalRisk}/100</p>
          </div>
          <div className="rounded-md bg-ink/40 p-3">
            <p className="text-xs text-muted">Diversifikation</p>
            <p className="mt-1 font-mono text-xl font-semibold text-cyan">{portfolio.diversificationScore}/100</p>
          </div>
        </div>
        <p className="mt-4 rounded-md border border-amber/25 bg-amber/10 p-3 text-xs leading-5 text-amber">
          {legalDisclaimer}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Positionen</h2>
          <div className="space-y-3">
            {portfolio.positions.map((item) => {
              const value = item.quantity * item.currentPrice;
              const cost = item.quantity * item.averagePrice;
              const pnl = value - cost;
              const weight = portfolio.totalValue ? (value / portfolio.totalValue) * 100 : 0;

              return (
                <div key={item.id} className="rounded-md border border-stroke bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.symbol}</p>
                      <p className="text-sm text-muted">{item.name}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`${item.symbol} entfernen`}
                      title="Entfernen"
                      onClick={() => setPositions((current) => current.filter((position) => position.id !== item.id))}
                      className="grid h-9 w-9 place-items-center rounded-md border border-stroke text-muted transition hover:border-loss/40 hover:text-loss"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <p className="text-sm text-muted">Menge <span className="block font-mono text-mist">{item.quantity}</span></p>
                    <p className="text-sm text-muted">Ø Kurs <span className="block font-mono text-mist">{formatCurrency(item.averagePrice, item.currency)}</span></p>
                    <p className="text-sm text-muted">Wert <span className="block font-mono text-mist">{formatCurrency(value, item.currency)}</span></p>
                    <p className="text-sm text-muted">G/V <span className={`block font-mono ${pnl >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(pnl, item.currency)}</span></p>
                    <p className="text-sm text-muted">Gewichtung <span className="block font-mono text-amber">{weight.toFixed(1)}%</span></p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-stroke">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${item.riskScore}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">Risiko je Position: {item.riskScore}/100</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Transaktion eintragen</h2>
          <div className="rounded-md border border-stroke bg-panel p-4">
            <label className="block text-sm text-muted" htmlFor="side">
              Vorgang
            </label>
            <select
              id="side"
              value={side}
              onChange={(event) => setSide(event.target.value as "buy" | "sell")}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            >
              <option value="buy">Einbuchung</option>
              <option value="sell">Reduktion</option>
            </select>
            <label className="block text-sm text-muted" htmlFor="symbol">
              Symbol
            </label>
            <input
              id="symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />
            <label className="mt-4 block text-sm text-muted" htmlFor="asset-type">
              Asset-Klasse
            </label>
            <select
              id="asset-type"
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AssetType)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            >
              <option value="stock">Aktie</option>
              <option value="etf">ETF</option>
              <option value="crypto">Krypto</option>
              <option value="forex">Forex</option>
              <option value="index">Index</option>
            </select>
            <label className="mt-4 block text-sm text-muted" htmlFor="sector">
              Branche / Thema
            </label>
            <input
              id="sector"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />
            <label className="mt-4 block text-sm text-muted" htmlFor="quantity">
              Menge
            </label>
            <input
              id="quantity"
              value={quantity}
              inputMode="decimal"
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />
            <label className="mt-4 block text-sm text-muted" htmlFor="price">
              Durchschnittskurs
            </label>
            <input
              id="price"
              value={price}
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />
            <label className="mt-4 block text-sm text-muted" htmlFor="risk-score">
              Risiko je Position 0-100
            </label>
            <input
              id="risk-score"
              value={riskScore}
              inputMode="numeric"
              onChange={(event) => setRiskScore(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stroke bg-ink px-3 text-mist outline-none focus:border-cyan"
            />
            <button
              type="button"
              onClick={submitTrade}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-profit font-semibold text-ink transition hover:bg-profit/90"
            >
              <Plus className="h-4 w-4" />
              Vorgang speichern
            </button>
            <p className="mt-3 text-xs leading-5 text-muted">
              Lokale Eingaben werden offline gespeichert. Supabase-Persistenz ist in der Datenarchitektur vorbereitet.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-md border border-stroke bg-panel p-4">
          <p className="text-sm font-semibold">Asset-Aufteilung</p>
          <div className="mt-3 space-y-2">
            {portfolio.assetAllocation.map((item) => (
              <div key={item.label} className="rounded-md bg-panel2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-mono">{item.weight.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-stroke bg-panel p-4">
          <p className="text-sm font-semibold">Branchenverteilung</p>
          <div className="mt-3 space-y-2">
            {portfolio.sectorAllocation.map((item) => (
              <div key={item.label} className="rounded-md bg-panel2 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <span className="font-mono">{item.weight.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ScenarioTable scenarios={portfolio.scenarios} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Portfolio-Warnungen</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.warnings.length ? (
            portfolio.warnings.map((warning) => (
              <div key={warning.id} className="rounded-md border border-stroke bg-panel p-4">
                <span className={`rounded-md border px-2 py-1 text-[11px] ${riskTone(warning.severity)}`}>
                  {warning.severity}
                </span>
                <p className="mt-3 text-sm font-semibold">{warning.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{warning.detail}</p>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-stroke bg-panel p-4 text-sm text-muted">
              Keine kritische Portfolio-Warnung im Modell erkannt. Das ist keine Garantie.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { Briefcase, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ScenarioTable } from "@/components/analysis-panels";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";
import { analyzePortfolio, applyPortfolioTrade } from "@/lib/portfolio-analytics";
import { formatCurrency, formatPercent, legalDisclaimer, riskTone } from "@/lib/scoring";
import { fetchWithSupabaseAuth } from "@/lib/supabase/client-fetch";
import { portfolioTradeInputSchema } from "@/lib/validation";
import type { AssetType, PortfolioPosition, PortfolioSummary, PortfolioTradeInput } from "@/lib/types";

type LocalPortfolioBook = {
  id: string;
  name: string;
  positions: PortfolioPosition[];
  createdAt: string;
  updatedAt: string;
};

type PortfolioTradeLog = PortfolioTradeInput & {
  id: string;
  portfolioId: string;
  status: "local" | "supabase";
  createdAt: string;
};

export function PortfolioView({ initialPortfolio }: { initialPortfolio: PortfolioSummary }) {
  const [positions, setPositions] = useState(initialPortfolio.positions);
  const [portfolioBooks, setPortfolioBooks] = useState<LocalPortfolioBook[]>(() => [
    {
      id: "main",
      name: "Hauptportfolio",
      positions: initialPortfolio.positions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
  const [activePortfolioId, setActivePortfolioId] = useState("main");
  const [newPortfolioName, setNewPortfolioName] = useState("Langfristiges Portfolio");
  const [tradeLog, setTradeLog] = useState<PortfolioTradeLog[]>([]);
  const [symbol, setSymbol] = useState("MSFT");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [sector, setSector] = useState("Software / Cloud");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("500");
  const [riskScore, setRiskScore] = useState("55");
  const [offlineReady, setOfflineReady] = useState(false);
  const [syncMode, setSyncMode] = useState<"demo" | "supabase">("demo");
  const [syncStatus, setSyncStatus] = useState("Beispielportfolio aktiv. Kein echter Billing-/Authstatus geprüft.");
  const [formError, setFormError] = useState("");
  const portfolio = useMemo(() => analyzePortfolio(positions), [positions]);
  const positive = portfolio.totalPnL >= 0;
  const activePortfolioName = portfolioBooks.find((book) => book.id === activePortfolioId)?.name ?? "Portfolio";

  useEffect(() => {
    if (!offlineReady) return;
    saveOfflineValue(OFFLINE_KEYS.portfolio, positions);
  }, [offlineReady, positions]);

  useEffect(() => {
    if (!offlineReady) return;
    saveOfflineValue(OFFLINE_KEYS.portfolioBooks, portfolioBooks);
  }, [offlineReady, portfolioBooks]);

  useEffect(() => {
    if (!offlineReady) return;
    saveOfflineValue(OFFLINE_KEYS.portfolioTrades, tradeLog);
  }, [offlineReady, tradeLog]);

  useEffect(() => {
    if (!offlineReady) return;
    setPortfolioBooks((current) =>
      current.map((book) =>
        book.id === activePortfolioId
          ? {
              ...book,
              positions,
              updatedAt: new Date().toISOString()
            }
          : book
      )
    );
  }, [activePortfolioId, offlineReady, positions]);

  useEffect(() => {
    let cancelled = false;
    const storedBooks = readOfflineValue<LocalPortfolioBook[]>(OFFLINE_KEYS.portfolioBooks);
    const storedTrades = readOfflineValue<PortfolioTradeLog[]>(OFFLINE_KEYS.portfolioTrades);
    const stored = readOfflineValue<typeof initialPortfolio.positions>(OFFLINE_KEYS.portfolio);

    if (storedBooks?.length) {
      setPortfolioBooks(storedBooks);
      setActivePortfolioId(storedBooks[0].id);
      setPositions(storedBooks[0].positions);
    }

    if (storedTrades?.length) setTradeLog(storedTrades);

    if (!storedBooks?.length && stored?.length) {
      setPositions(stored);
      if (!navigator.onLine) setSyncStatus("Offline-Portfolio aus lokalem Speicher geladen.");
    }
    setOfflineReady(true);

    fetchWithSupabaseAuth("/api/portfolio")
      .then((response) => response.json())
      .then((data: PortfolioSummary & { mode?: string }) => {
        if (cancelled || !data.positions?.length) return;
        setPositions(data.positions);
        setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
        setSyncStatus(data.mode === "supabase" ? "Supabase-Portfolio aktiv." : "Beispielportfolio / lokaler Demo-Modus aktiv.");
      })
      .catch(() => {
        if (!cancelled) {
          const fallback = readOfflineValue<typeof initialPortfolio.positions>(OFFLINE_KEYS.portfolio);
          if (fallback?.length) setPositions(fallback);
          setSyncMode("demo");
          setSyncStatus(fallback?.length ? "Offline-Portfolio aus lokalem Speicher geladen." : "Supabase nicht erreichbar. Beispielportfolio aktiv.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function createPortfolio() {
    const name = newPortfolioName.trim().replace(/[<>]/g, "").slice(0, 60) || "Neues Portfolio";
    const next: LocalPortfolioBook = {
      id: `portfolio-${Date.now()}`,
      name,
      positions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPortfolioBooks((current) => [next, ...current]);
    setActivePortfolioId(next.id);
    setPositions([]);
    setSyncMode("demo");
    setSyncStatus("Neues lokales Portfolio erstellt. Cloud-Sync erst mit Supabase-Session.");
  }

  function duplicatePortfolio() {
    const next: LocalPortfolioBook = {
      id: `portfolio-${Date.now()}`,
      name: `${activePortfolioName} Kopie`.slice(0, 60),
      positions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPortfolioBooks((current) => [next, ...current]);
    setActivePortfolioId(next.id);
    setSyncStatus("Portfolio lokal dupliziert.");
  }

  function switchPortfolio(id: string) {
    const next = portfolioBooks.find((book) => book.id === id);
    if (!next) return;
    setActivePortfolioId(next.id);
    setPositions(next.positions);
    setSyncStatus(`Lokales Portfolio "${next.name}" geöffnet.`);
  }

  function deleteActivePortfolio() {
    if (portfolioBooks.length <= 1) {
      setSyncStatus("Mindestens ein Portfolio bleibt erhalten.");
      return;
    }

    const remaining = portfolioBooks.filter((book) => book.id !== activePortfolioId);
    setPortfolioBooks(remaining);
    setActivePortfolioId(remaining[0].id);
    setPositions(remaining[0].positions);
    setSyncStatus("Portfolio lokal gelöscht.");
  }

  function addTradeLog(trade: PortfolioTradeInput, status: PortfolioTradeLog["status"]) {
    setTradeLog((current) => [
      {
        ...trade,
        id: `trade-${Date.now()}`,
        portfolioId: activePortfolioId,
        status,
        createdAt: new Date().toISOString()
      },
      ...current
    ].slice(0, 80));
  }

  async function submitTrade() {
    const qty = Number(quantity);
    const avg = Number(price);
    const risk = Number(riskScore);

    const trade = {
        symbol: symbol.trim().toUpperCase(),
        side,
        assetType,
        sector,
        quantity: qty,
        price: avg,
        currency: "USD",
        riskScore: risk
      };
    const parsedTrade = portfolioTradeInputSchema.safeParse(trade);
    setFormError("");

    if (!parsedTrade.success || Number.isNaN(qty) || Number.isNaN(avg) || Number.isNaN(risk)) {
      setFormError("Bitte Symbol, Branche, Menge, Kurs und Risiko sauber eingeben. Sonderzeichen wie < oder > sind nicht erlaubt.");
      return;
    }

    try {
      const response = await fetchWithSupabaseAuth("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsedTrade.data)
      });
      if (!response.ok) throw new Error("portfolio mutation not authenticated");
      const data = await response.json() as { portfolio?: PortfolioSummary; mode?: string };

      if (data.portfolio?.positions) {
        setPositions(data.portfolio.positions);
      } else {
        setPositions((current) => applyPortfolioTrade(current, parsedTrade.data));
      }

      setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
      setSyncStatus(data.mode === "supabase" ? "Transaktion in Supabase gespeichert." : "Transaktion lokal gespeichert.");
      addTradeLog(parsedTrade.data, data.mode === "supabase" ? "supabase" : "local");
    } catch {
      setPositions((current) => applyPortfolioTrade(current, parsedTrade.data));
      setSyncMode("demo");
      setSyncStatus("Nicht eingeloggt oder Supabase nicht erreichbar. Transaktion nur lokal im Demo-Portfolio gespeichert.");
      addTradeLog(parsedTrade.data, "local");
    }

    setQuantity("1");
    setPrice("500");
  }

  async function removePosition(id: string) {
    const removed = positions.find((position) => position.id === id);
    setPositions((current) => current.filter((position) => position.id !== id));

    try {
      const response = await fetchWithSupabaseAuth("/api/portfolio", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("portfolio delete not authenticated");
      const data = await response.json() as { portfolio?: PortfolioSummary; mode?: string };
      if (data.portfolio?.positions) setPositions(data.portfolio.positions);
      setSyncMode(data.mode === "supabase" ? "supabase" : "demo");
      setSyncStatus(data.mode === "supabase" ? "Position in Supabase entfernt." : "Position lokal entfernt.");
    } catch {
      setSyncMode("demo");
      setSyncStatus("Supabase nicht erreichbar. Position lokal entfernt.");
    }

    if (removed) {
      addTradeLog(
        {
          symbol: removed.symbol,
          name: removed.name,
          side: "sell",
          assetType: removed.assetType,
          sector: removed.sector,
          quantity: removed.quantity,
          price: removed.currentPrice,
          currency: removed.currency,
          riskScore: removed.riskScore
        },
        "local"
      );
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-md border border-stroke bg-[linear-gradient(140deg,#101712,#07100d_70%,#172114)] p-5 shadow-panel">
        <p className="text-sm text-muted">Portfolio</p>
        <h1 className="mt-2 text-3xl font-semibold">{activePortfolioName}: Positionen und Risiko</h1>
        <p className="mt-3 rounded-md border border-amber/30 bg-amber/10 p-3 text-xs leading-5 text-amber">
          {syncMode === "supabase"
            ? "Echtes Nutzerportfolio: Positionen werden mit Supabase synchronisiert."
            : "Beispielportfolio / lokaler Demo-Modus: Werte sind nicht als echte Depotdaten zu verstehen."}
        </p>
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
        <p className={`mt-3 rounded-xl border px-3 py-2 text-xs ${syncMode === "supabase" ? "border-profit/30 bg-profit/10 text-profit" : "border-amber/30 bg-amber/10 text-amber"}`}>{syncStatus}</p>
      </section>

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-cyan" />
              <h2 className="text-lg font-semibold text-mist">Mehrere Portfolios</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Lokale Portfolios sind vollständig nutzbar und offline gespeichert. Supabase-Sync wird nur angezeigt,
              wenn ein echter Login aktiv ist.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={newPortfolioName}
              onChange={(event) => setNewPortfolioName(event.target.value.slice(0, 60))}
              className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan"
              aria-label="Neuer Portfolio-Name"
            />
            <button type="button" onClick={createPortfolio} className="h-11 rounded-xl bg-profit px-4 font-semibold text-ink">Neu</button>
            <button type="button" onClick={duplicatePortfolio} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 font-semibold text-cyan">
              <Copy className="h-4 w-4" />
              Kopie
            </button>
            <button type="button" onClick={deleteActivePortfolio} className="h-11 rounded-xl border border-loss/30 bg-loss/10 px-4 font-semibold text-loss">Löschen</button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {portfolioBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => switchPortfolio(book.id)}
              className={`shrink-0 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                book.id === activePortfolioId ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-stroke bg-coal text-muted hover:text-mist"
              }`}
            >
              <span className="block font-semibold">{book.name}</span>
              <span className="mt-1 block text-xs">{book.positions.length} Positionen</span>
            </button>
          ))}
        </div>
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
                      onClick={() => removePosition(item.id)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-stroke text-muted transition hover:border-loss/40 hover:text-loss"
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
            {formError ? <p className="mt-3 rounded-md border border-loss/30 bg-loss/10 p-3 text-xs leading-5 text-loss">{formError}</p> : null}
            <p className="mt-3 text-xs leading-5 text-muted">
              Lokale Eingaben werden offline gespeichert. Bei aktivem Supabase-Login werden Transaktionen und Positionen synchronisiert.
              Ohne Login ist dies ein lokales Beispielportfolio.
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

      <section className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
        <h2 className="text-lg font-semibold text-mist">Transaktionshistorie</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Käufe, Verkäufe und Positionslöschungen werden lokal protokolliert. Das schafft Nachvollziehbarkeit,
          auch wenn noch kein echter Broker-Import aktiv ist.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-stroke">
          {tradeLog.filter((trade) => trade.portfolioId === activePortfolioId).length ? tradeLog.filter((trade) => trade.portfolioId === activePortfolioId).slice(0, 20).map((trade) => (
            <div key={trade.id} className="grid gap-2 border-b border-stroke bg-coal/60 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[0.7fr_0.7fr_1fr_1fr_0.8fr]">
              <span className={trade.side === "buy" ? "font-semibold text-profit" : "font-semibold text-loss"}>{trade.side === "buy" ? "Kauf" : "Verkauf"}</span>
              <span className="font-mono text-mist">{trade.symbol}</span>
              <span className="text-muted">{trade.quantity} Stück zu {formatCurrency(trade.price, trade.currency)}</span>
              <span className="text-muted">{new Date(trade.createdAt).toLocaleString("de-DE")}</span>
              <span className={trade.status === "supabase" ? "text-profit" : "text-amber"}>{trade.status === "supabase" ? "Cloud" : "Lokal"}</span>
            </div>
          )) : (
            <p className="bg-coal/60 px-4 py-6 text-sm text-muted">Noch keine Transaktionen gespeichert.</p>
          )}
        </div>
      </section>
    </div>
  );
}

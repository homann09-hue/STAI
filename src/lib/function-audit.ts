export type AppFunctionStatus = "live" | "degraded" | "demo" | "prepared" | "blocked";

export type AppFunctionPriority = "P0" | "P1" | "P2";

export type AppFunctionAudit = {
  id: string;
  area: string;
  route: string;
  status: AppFunctionStatus;
  priority: AppFunctionPriority;
  userValue: string;
  dataTruth: string;
  dependency: string;
  improvement: string;
};

export const appFunctionAudits: AppFunctionAudit[] = [
  {
    id: "dashboard",
    area: "Dashboard",
    route: "/",
    status: "live",
    priority: "P0",
    userValue: "Marktüberblick, Watchlist, Chancen/Risiken und KI-Summary in einer Startansicht.",
    dataTruth: "Kurs- und News-Badges zeigen Provider, Qualität und Mock/Delay-Status.",
    dependency: "Market-Provider, News-Provider, lokale Watchlist.",
    improvement: "Dashboard nutzt jetzt zentrale Funktionsmetriken statt statischer Roadmap-Labels."
  },
  {
    id: "markets",
    area: "Märkte",
    route: "/markets",
    status: "degraded",
    priority: "P1",
    userValue: "Globale Assetklassen, Gewinner/Verlierer, Most Active und Marktstatus.",
    dataTruth: "Live nur dort, wo Anbieter und Lizenz es liefern; sonst klar als delayed/mock markiert.",
    dependency: "Finnhub, FMP, Alpha Vantage, Krypto-Provider, Provider-Fallbacks.",
    improvement: "Große Trefferlisten werden begrenzt und Empty-States erklären Datenlücken."
  },
  {
    id: "stocks",
    area: "Aktien",
    route: "/stocks",
    status: "degraded",
    priority: "P1",
    userValue: "Aktienkurse, Fundamentaldaten, technische Signale und Asset-Details.",
    dataTruth: "Fundamentals können providerabhängig gecached oder unvollständig sein.",
    dependency: "FMP/Finnhub/Fundamentals-Provider.",
    improvement: "Keine Score-Ableitung ohne sichtbaren Datenqualitätsstatus."
  },
  {
    id: "etfs",
    area: "ETFs",
    route: "/etfs",
    status: "prepared",
    priority: "P1",
    userValue: "ETF-Struktur, Kosten, Holdings, Risiko und Benchmark-Vergleich.",
    dataTruth: "Viele ETF-Felder brauchen lizenzierte Anbieter wie Morningstar, MSCI, BlackRock oder Vanguard.",
    dependency: "ETF-Provider, Holdings-Daten, Kosten- und Benchmark-Daten.",
    improvement: "ETF-Profi-Daten bleiben als vorbereitet markiert, bis echte Anbieter angebunden sind."
  },
  {
    id: "crypto",
    area: "Krypto",
    route: "/crypto",
    status: "live",
    priority: "P1",
    userValue: "Nahe Echtzeit für Krypto-Preise, Volumen und Trendübersichten.",
    dataTruth: "Exchange-Daten können near-realtime sein; Bid/Ask hängt vom Anbieter und Paar ab.",
    dependency: "Binance/Coinbase-Provider, Fallback-Caches.",
    improvement: "Krypto bleibt getrennt von Aktienlizenzen und zeigt Providerstatus pro Kurs."
  },
  {
    id: "indices",
    area: "Indizes",
    route: "/indices",
    status: "degraded",
    priority: "P2",
    userValue: "DAX, S&P 500, Nasdaq und weitere Marktbarometer.",
    dataTruth: "Indexdaten sind oft delayed oder lizenzpflichtig.",
    dependency: "Index-Provider und Börsenlizenzen.",
    improvement: "Indexdaten dürfen nicht als Realtime erscheinen, wenn sie delayed sind."
  },
  {
    id: "screener",
    area: "Screener",
    route: "/screener",
    status: "demo",
    priority: "P1",
    userValue: "Filter für Assetklasse, Risiko, Score, Momentum und Datenqualität.",
    dataTruth: "Ohne vollständige Universumsdaten ist der Screener ein Demo-/MVP-Modus.",
    dependency: "Instrumentenuniversum, Fundamentals, News, technische Daten.",
    improvement: "Screener muss Trefferumfang und Datenlücken sichtbar kommunizieren."
  },
  {
    id: "watchlist",
    area: "Watchlist",
    route: "/watchlist",
    status: "live",
    priority: "P0",
    userValue: "Lokale Watchlist mit Sanitizing, Duplikatschutz, Refresh-Intervallen und optionalem Cloud-Sync.",
    dataTruth: "Cloud-Sync nur mit Supabase-Session; lokale Daten bleiben als lokal markiert.",
    dependency: "localStorage, Supabase Auth, Watchlist API.",
    improvement: "Refresh-Profile schützen Provider vor unnötigen Requests."
  },
  {
    id: "portfolio",
    area: "Portfolio",
    route: "/portfolio",
    status: "live",
    priority: "P0",
    userValue: "Mehrere lokale Portfolios, Positionen, Transaktionshistorie, Gewichtung, Gewinn/Verlust, Risiko und Allocation.",
    dataTruth: "Lokale Portfolios sind nutzbar und klar von echtem Supabase-/Broker-Sync getrennt.",
    dependency: "Supabase-Session, Portfolio-Tabellen, aktuelle Quotes.",
    improvement: "Mehrere Portfolios und Historie funktionieren lokal; Cloud/Broker-Sync bleibt statusklar."
  },
  {
    id: "alerts",
    area: "Alarme",
    route: "/alerts",
    status: "degraded",
    priority: "P0",
    userValue: "Preis-, RSI-, News-, Volumen-, Earnings- und KI-Risikoalarme mit lokaler Prüfoberfläche.",
    dataTruth: "Lokale Prüfungen sind nutzbar; echte Push/E-Mail/Webhook-Ausführung braucht Backend-Worker.",
    dependency: "Backend-Jobs, Notifications, Supabase, Provider-Webhooks.",
    improvement: "Alerts trennen lokal geprüft, ausgelöst, pausiert und Backend-Worker fehlt."
  },
  {
    id: "news",
    area: "News-Terminal",
    route: "/news-terminal",
    status: "degraded",
    priority: "P1",
    userValue: "News mit Quelle, Zeit, Sentiment, Impact und Relevanz.",
    dataTruth: "Mock-News dürfen nie als echte Ereignisse erscheinen.",
    dependency: "NewsAPI, Marketaux, Provider-Caches, Link-Validierung.",
    improvement: "Jede News braucht Quellenstatus und darf keine ungeprüfte Tatsache erzwingen."
  },
  {
    id: "calendar",
    area: "Kalender",
    route: "/calendar",
    status: "live",
    priority: "P2",
    userValue: "Eigene Earnings-, Dividenden-, Split-, Makro- und Zinsereignisse lokal verwalten.",
    dataTruth: "Nutzertermine sind lokal; Demo-/Provider-Termine bleiben klar markiert.",
    dependency: "Earnings-/Events-Provider.",
    improvement: "Kalender ist lokal nutzbar und wartet nur für echte Marktevents auf Provider."
  },
  {
    id: "analyses",
    area: "Analysen",
    route: "/analyses",
    status: "live",
    priority: "P1",
    userValue: "Analyse-Workbench mit Fazit, Bull/Bear/Neutral Case, Wahrscheinlichkeiten und gespeicherten Einschätzungen.",
    dataTruth: "Workbench-Ausgaben sind modellbasierte Schätzungen, keine Garantie und keine Anlageberatung.",
    dependency: "AIAnalysisProvider, Quellenstatus, Datenfrische.",
    improvement: "Analyse ist lokal nutzbar; echte KI-Provider können serverseitig ergänzt werden."
  },
  {
    id: "backtesting",
    area: "Backtesting",
    route: "/backtesting",
    status: "live",
    priority: "P2",
    userValue: "Lokale Strategie-Simulation mit Rendite, Volatilität, Drawdown, Szenarien und gespeicherten Annahmen.",
    dataTruth: "Szenario-Backtests sind Modellannahmen; historische, adjustierte Daten brauchen Provider.",
    dependency: "HistoricalProvider, Corporate Actions, Benchmark-Daten.",
    improvement: "Backtesting ist als Modell nutzbar und bleibt transparent gegenüber echten historischen Daten."
  },
  {
    id: "learn",
    area: "Investieren lernen",
    route: "/learn",
    status: "live",
    priority: "P2",
    userValue: "Einsteigerwissen, Glossar und Beispielportfolios.",
    dataTruth: "Lerninhalte sind Bildung, keine individuelle Anlageberatung.",
    dependency: "Redaktionelle Inhalte und Risiko-Hinweise.",
    improvement: "Anfänger bekommen klare Sprache, Profis können tiefer einsteigen."
  },
  {
    id: "pricing",
    area: "Pricing",
    route: "/pricing",
    status: "prepared",
    priority: "P1",
    userValue: "Free, Starter, Pro und Elite/Business als Feature-Matrix.",
    dataTruth: "Billing-Gates sind vorbereitet, aber nicht hart erzwungen, solange Billing fehlt.",
    dependency: "Auth, Billing, Entitlements.",
    improvement: "Keine Pro-Anzeige ohne echten User- oder Billingstatus."
  },
  {
    id: "settings",
    area: "Einstellungen",
    route: "/settings",
    status: "live",
    priority: "P0",
    userValue: "Investor-Level, Auth, Datenverhalten, Transparenz und Funktionsstatus.",
    dataTruth: "Settings zeigen, welche Funktionen aktiv, eingeschränkt oder vorbereitet sind.",
    dependency: "Supabase Auth, lokale Einstellungen, Funktions-Audit.",
    improvement: "Settings werden zum Kontrollraum für Vertrauen, Datenstatus und Produktreife."
  },
  {
    id: "pwa",
    area: "PWA & Offline",
    route: "app-shell",
    status: "degraded",
    priority: "P1",
    userValue: "Installierbare App, Offline-Shell und Aktualisierung bei neuer Verbindung.",
    dataTruth: "Offline kann nur letzte lokale Daten zeigen; Providerdaten brauchen Verbindung.",
    dependency: "Service Worker, Cache-Versionierung, localStorage.",
    improvement: "PWA-Status meldet Offline, Online und neue App-Versionen sichtbar."
  }
];

const statusScores: Record<AppFunctionStatus, number> = {
  live: 100,
  degraded: 72,
  demo: 46,
  prepared: 38,
  blocked: 12
};

export const functionStatusSummary = appFunctionAudits.reduce(
  (summary, item) => {
    summary[item.status] += 1;
    return summary;
  },
  {
    live: 0,
    degraded: 0,
    demo: 0,
    prepared: 0,
    blocked: 0,
    total: appFunctionAudits.length
  } satisfies Record<AppFunctionStatus, number> & { total: number }
);

export const functionReadinessScore = Math.round(
  appFunctionAudits.reduce((sum, item) => sum + statusScores[item.status], 0) / appFunctionAudits.length
);

export const criticalFunctionRisks = appFunctionAudits.filter(
  (item) => item.priority !== "P2" && item.status !== "live"
);

export function getFunctionStatusLabel(status: AppFunctionStatus) {
  if (status === "live") return "Aktiv";
  if (status === "degraded") return "Eingeschränkt";
  if (status === "demo") return "Demo";
  if (status === "prepared") return "Vorbereitet";
  return "Blockiert";
}

export function getFunctionStatusTone(status: AppFunctionStatus) {
  if (status === "live") return "border-profit/30 bg-profit/10 text-profit";
  if (status === "degraded") return "border-amber/30 bg-amber/10 text-amber";
  if (status === "demo") return "border-cyan/30 bg-cyan/10 text-cyan";
  if (status === "prepared") return "border-steel/30 bg-steel/10 text-steel";
  return "border-loss/30 bg-loss/10 text-loss";
}

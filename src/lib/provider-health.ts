import type { MarketDataQuality } from "@/lib/types";
import {
  getMarketDataEnvironment,
  getProviderLicensePolicy,
  type ProviderId,
} from "@/lib/providers/provider-registry";

export type ProviderCategory = "market" | "crypto" | "news" | "fundamentals" | "ai" | "auth" | "cache" | "billing";
export type ProviderOperationalStatus = "ready" | "degraded" | "configured" | "missing_key" | "license_required" | "demo";

export type ProviderHealthItem = {
  id: string;
  name: string;
  category: ProviderCategory;
  status: ProviderOperationalStatus;
  quality: MarketDataQuality | "cached" | "not_applicable";
  configured: boolean;
  secretEnv: string[];
  publicEnv?: string[];
  capabilities: string[];
  limitations: string[];
  fallback: string;
  userImpact: string;
  nextAction: string;
};

export type ProviderHealthReport = {
  generatedAt: string;
  readinessScore: number;
  totals: Record<ProviderOperationalStatus, number> & { total: number };
  items: ProviderHealthItem[];
  topRisks: ProviderHealthItem[];
  nextActions: string[];
};

export type PublicProviderCapability = {
  id: ProviderCategory;
  label: string;
  status: ProviderOperationalStatus;
  quality: ProviderHealthItem["quality"];
  configuredCount: number;
  totalCount: number;
  readinessScore: number;
  liveClaim: "allowed" | "limited" | "blocked";
  capabilities: string[];
  limitations: string[];
  userImpact: string;
  nextAction: string;
};

export type PublicProviderCapabilityReport = {
  generatedAt: string;
  readinessScore: number;
  categories: PublicProviderCapability[];
  criticalLimitations: string[];
  nextActions: string[];
  publicNotice: string;
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function qualityFromEnv(name: string, fallback: MarketDataQuality): MarketDataQuality {
  const value = process.env[name] as MarketDataQuality | undefined;
  const allowed: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];
  return value && allowed.includes(value) ? value : fallback;
}

const statusScore: Record<ProviderOperationalStatus, number> = {
  ready: 100,
  configured: 86,
  degraded: 68,
  demo: 48,
  license_required: 36,
  missing_key: 16
};

const categoryLabels: Record<ProviderCategory, string> = {
  market: "Marktdaten",
  crypto: "Krypto",
  news: "News & Events",
  fundamentals: "Fundamentaldaten",
  ai: "KI-Analyse",
  auth: "Auth & Userdaten",
  cache: "Cache & Limits",
  billing: "Billing & Gates"
};

const statusPriority: ProviderOperationalStatus[] = [
  "missing_key",
  "license_required",
  "demo",
  "degraded",
  "configured",
  "ready"
];

function uniqueLimited(items: string[], limit: number) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function worstStatus(items: ProviderHealthItem[]) {
  return items
    .map((item) => item.status)
    .sort((a, b) => statusPriority.indexOf(a) - statusPriority.indexOf(b))[0] ?? "missing_key";
}

function bestQuality(items: ProviderHealthItem[]): ProviderHealthItem["quality"] {
  const qualityRank: Record<ProviderHealthItem["quality"], number> = {
    realtime: 7,
    near_realtime: 6,
    delayed: 5,
    historical: 4,
    cached: 3,
    mock: 2,
    unavailable: 1,
    not_applicable: 0
  };
  return items
    .map((item) => item.quality)
    .sort((a, b) => qualityRank[b] - qualityRank[a])[0] ?? "unavailable";
}

function liveClaimFor(items: ProviderHealthItem[]) {
  if (items.some((item) => item.quality === "realtime" && item.status === "ready")) return "allowed" as const;
  if (items.some((item) => item.quality === "near_realtime" && item.configured)) return "limited" as const;
  return "blocked" as const;
}

function provider(item: ProviderHealthItem): ProviderHealthItem {
  return item;
}

export function getProviderHealthReport(now = new Date()): ProviderHealthReport {
  const finnhubConfigured = hasEnv("FINNHUB_API_KEY");
  const twelveDataConfigured =
    hasEnv("TWELVE_DATA_API_KEY") || hasEnv("TWELVEDATA_API_KEY");
  const fmpConfigured = hasEnv("FMP_API_KEY");
  const alphaConfigured = hasEnv("ALPHA_VANTAGE_API_KEY");
  const newsApiConfigured = hasEnv("NEWS_API_KEY") || hasEnv("NEWSAPI_API_KEY");
  const marketauxConfigured = hasEnv("MARKETAUX_API_KEY");
  const supabaseConfigured =
    hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    (hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const supabaseSecretConfigured = hasEnv("SUPABASE_SERVICE_ROLE_KEY") || hasEnv("SUPABASE_SECRET_KEY");
  const sharedCacheConfigured = hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN");
  const billingConfigured = hasEnv("STRIPE_SECRET_KEY") || hasEnv("LEMONSQUEEZY_API_KEY");
  const marketEnvironment = getMarketDataEnvironment();
  const providerCanRun = (id: ProviderId) =>
    marketEnvironment === "development" ||
    marketEnvironment === "test" ||
    getProviderLicensePolicy(id).externalDisplayAllowed;

  const items: ProviderHealthItem[] = [
    provider({
      id: "finnhub",
      name: "Finnhub",
      category: "market",
      status: finnhubConfigured ? (providerCanRun("finnhub") ? "configured" : "degraded") : "missing_key",
      quality: finnhubConfigured && providerCanRun("finnhub") ? qualityFromEnv("FINNHUB_DATA_QUALITY", "near_realtime") : "unavailable",
      configured: finnhubConfigured,
      secretEnv: ["FINNHUB_API_KEY"],
      capabilities: ["Aktien-Quotes", "News", "Fundamentals je nach Plan", "WebSocket je nach Plan"],
      limitations: ["Bid/Ask und Realtime hängen vom Plan und Börsenlizenzen ab", "Rate-Limits im Free/Starter-Bereich"],
      fallback: "FMP, Alpha Vantage, letzter bestätigter Cache oder nicht verfügbar",
      userImpact: finnhubConfigured ? "Marktdaten können providerbasiert geladen werden." : "Andere echte Anbieter dürfen übernehmen; ohne Beleg bleibt der Kurs nicht verfügbar.",
      nextAction: finnhubConfigured ? "Plan/Lizenz prüfen und Datenqualität pro Markt festlegen." : "FINNHUB_API_KEY serverseitig in Vercel setzen."
    }),
    provider({
      id: "twelve-data",
      name: "Twelve Data",
      category: "market",
      status: twelveDataConfigured
        ? providerCanRun("twelve_data")
          ? "configured"
          : "license_required"
        : "missing_key",
      quality:
        twelveDataConfigured && providerCanRun("twelve_data")
          ? qualityFromEnv("TWELVE_DATA_QUALITY", "near_realtime")
          : "unavailable",
      configured: twelveDataConfigured,
      secretEnv: ["TWELVE_DATA_API_KEY", "TWELVEDATA_API_KEY"],
      capabilities: [
        "Globale Instrumentensuche",
        "Einzel- und Batch-Quotes",
        "Intraday- und Tageskerzen",
        "Boersenstatus",
        "WebSocket planabhaengig",
      ],
      limitations: [
        "Basic: 8 API-Credits pro Minute und 800 pro Tag",
        "WebSocket im Basic/Grow-Tarif nur fuer Trial-Symbole",
        "Externe Anzeige bleibt ohne dokumentierte Display-Rechte gesperrt",
        "WebSocket liefert kein Bid/Ask oder OHLC",
      ],
      fallback:
        "Finnhub/FMP je Datentyp, letzter bestaetigter Cache oder nicht verfuegbar",
      userImpact: twelveDataConfigured
        ? providerCanRun("twelve_data")
          ? "Globale Suche, Quotes und Kerzen koennen intern providerbasiert geladen werden."
          : "Provider ist konfiguriert, aber fuer externe Anzeige rechtlich gesperrt."
        : "Twelve Data bleibt deaktiviert; andere echte Anbieter duerfen uebernehmen.",
      nextAction: twelveDataConfigured
        ? "Tarif und Display-Rechte dokumentieren; Stream nur bei passender Freigabe aktivieren."
        : "TWELVE_DATA_API_KEY ausschliesslich serverseitig setzen.",
    }),
    provider({
      id: "fmp",
      name: "Financial Modeling Prep",
      category: "fundamentals",
      status: fmpConfigured ? "degraded" : "missing_key",
      quality: fmpConfigured && providerCanRun("fmp") ? qualityFromEnv("FMP_DATA_QUALITY", "delayed") : "unavailable",
      configured: fmpConfigured,
      secretEnv: ["FMP_API_KEY"],
      capabilities: ["Fundamentaldaten", "Financial Statements", "Profile", "Kursdaten je nach Plan"],
      limitations: ["Free-Pläne können stark limitiert sein", "Backoff greift bei 429 Rate-Limits"],
      fallback: "Alpha Vantage oder klar als nicht verfügbar ausweisen",
      userImpact: fmpConfigured ? "Fundamentaldaten sind möglich, aber Rate-Limits werden sichtbar behandelt." : "Nicht belegte Fundamentaldaten werden nicht angezeigt.",
      nextAction: "Provider-Coverage je Assetklasse messen und Rate-Limit-Budget sichtbar machen."
    }),
    provider({
      id: "alpha-vantage",
      name: "Alpha Vantage",
      category: "market",
      status: alphaConfigured ? "degraded" : "missing_key",
      quality: alphaConfigured && providerCanRun("alpha_vantage") ? qualityFromEnv("ALPHA_VANTAGE_DATA_QUALITY", "delayed") : "unavailable",
      configured: alphaConfigured,
      secretEnv: ["ALPHA_VANTAGE_API_KEY"],
      capabilities: ["Fallback-Quotes", "Zeitreihen", "Indikatoren je nach Endpoint"],
      limitations: ["Sehr enge Rate-Limits", "Nicht als professionelle Hauptquelle geeignet"],
      fallback: "Nur Fallback hinter professionelleren Providern",
      userImpact: alphaConfigured ? "Kann Lücken füllen, aber nicht als Realtime verkauft werden." : "Kein Alpha-Vantage-Fallback aktiv.",
      nextAction: "Nur als klar markierten Fallback nutzen."
    }),
    provider({
      id: "binance-coinbase",
      name: "Binance / Coinbase",
      category: "crypto",
      status: providerCanRun("binance") || providerCanRun("coinbase") ? "ready" : "degraded",
      quality: providerCanRun("binance") || providerCanRun("coinbase") ? "near_realtime" : "unavailable",
      configured: true,
      secretEnv: [],
      capabilities: ["Krypto-Quotes", "24h Volumen", "nahe Echtzeit je Endpoint", "REST/WebSocket-Struktur vorbereitet"],
      limitations: ["Exchange-Daten sind keine regulierte Börsen-Konsolidierung", "Bid/Ask hängt vom Handelspaar ab"],
      fallback: "Letzten bestätigten Cache anzeigen oder als nicht verfügbar ausweisen",
      userImpact: providerCanRun("binance") || providerCanRun("coinbase")
        ? "Krypto kann deutlich näher an Echtzeit laufen als viele kostenlose Aktienfeeds."
        : "Krypto-Marktdaten bleiben bis zur bestätigten externen Darstellungsfreigabe gesperrt.",
      nextAction: "Subscriptions auf sichtbare Symbole begrenzen und Orderbook-Felder nur bei echten Daten zeigen."
    }),
    provider({
      id: "news",
      name: "NewsAPI / Marketaux",
      category: "news",
      status: newsApiConfigured || marketauxConfigured
        ? (providerCanRun(marketauxConfigured ? "marketaux" : "newsapi") ? "configured" : "degraded")
        : "missing_key",
      quality: (newsApiConfigured || marketauxConfigured)
        && providerCanRun(marketauxConfigured ? "marketaux" : "newsapi")
        ? "near_realtime"
        : "unavailable",
      configured: newsApiConfigured || marketauxConfigured,
      secretEnv: ["NEWS_API_KEY", "NEWSAPI_API_KEY", "MARKETAUX_API_KEY"],
      capabilities: ["Unternehmensnachrichten", "Quellen", "Zeitstempel", "Sentiment/Impact vorbereitet"],
      limitations: ["Lizenzbedingungen und Caching-Regeln beachten", "News dürfen nicht ungeprüft als Fakt verkauft werden"],
      fallback: "Ohne bestätigte Quelle keine Nachricht anzeigen",
      userImpact: newsApiConfigured || marketauxConfigured ? "News können mit Quelle und Datum geladen werden." : "Das News-Terminal weist fehlende Nachrichten als nicht verfügbar aus.",
      nextAction: "Provider-spezifische Lizenztexte und Quellenlinks vollständig anzeigen."
    }),
    provider({
      id: "supabase",
      name: "Supabase Auth & Userdaten",
      category: "auth",
      status: supabaseConfigured ? (supabaseSecretConfigured ? "ready" : "configured") : "missing_key",
      quality: "not_applicable",
      configured: supabaseConfigured,
      secretEnv: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
      publicEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      capabilities: ["Auth", "Watchlists", "Portfolio", "Alerts", "User-Settings", "RLS pro user_id"],
      limitations: ["Cloud-Sync nur mit Session", "Servermutationen brauchen sichere RLS-Policies"],
      fallback: "Lokaler Gastmodus ohne Cloud-Synchronisierung",
      userImpact: supabaseConfigured ? "Cloud-Userdaten sind technisch vorbereitet." : "Nur lokaler Gastmodus aktiv.",
      nextAction: "User-Settings, mehrere Portfolios und Alert-Regeln an echte Session koppeln."
    }),
    provider({
      id: "cache",
      name: "Server Cache / Rate-Limit-Schutz",
      category: "cache",
      status: sharedCacheConfigured ? "ready" : "degraded",
      quality: "cached",
      configured: sharedCacheConfigured,
      secretEnv: ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"],
      publicEnv: ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"],
      capabilities: ["TTL-Cache", "Rate-Limit-Buckets", "Fallback auf Memory", "Provider-Schonung"],
      limitations: ["Memory-Cache ist nicht instanzübergreifend", "Shared Cache ist für Skalierung besser"],
      fallback: "In-Memory Cache pro Serverless-Instanz",
      userImpact: sharedCacheConfigured ? "Viele Nutzer teilen stabilere Cache-/Rate-Limit-Budgets." : "Bei viel Traffic können mehr Provider-Calls entstehen.",
      nextAction: sharedCacheConfigured ? "Cache-Hit-Rates messen." : "Upstash/Vercel KV für geteilte Limits aktivieren."
    }),
    provider({
      id: "ai-evidence",
      name: "StockPilot Deterministic Evidence Engine",
      category: "ai",
      status: "ready",
      quality: "not_applicable",
      configured: true,
      secretEnv: [],
      capabilities: ["Evidenzgebundene Zusammenfassungen", "Bull/Bear/Neutral Cases", "Unsicherheiten", "Datenqualitäts-Hinweise"],
      limitations: ["Nur modellbasierte Einschätzung aus belegten Eingangsdaten", "Keine Garantie und keine Anlageberatung"],
      fallback: "Bei unzureichender Evidenz wird die Analyse blockiert",
      userImpact: "Analysen werden deterministisch aus Quellenstatus, Datenfrische und geprüften Kennzahlen aufgebaut.",
      nextAction: "Trefferbilanz und Quellenabdeckung der Evidence Engine weiter messen."
    }),
    provider({
      id: "billing",
      name: "Billing & Entitlements",
      category: "billing",
      status: billingConfigured ? "configured" : "demo",
      quality: "not_applicable",
      configured: billingConfigured,
      secretEnv: ["STRIPE_SECRET_KEY", "LEMONSQUEEZY_API_KEY"],
      capabilities: ["Free", "Starter", "Pro", "Elite/Business", "Feature-Gates"],
      limitations: ["Ohne Billing darf kein Pro-Status als aktiv erscheinen"],
      fallback: "Nicht freigeschaltet; keine stillschweigende Pro-Berechtigung",
      userImpact: billingConfigured ? "Entitlements können angebunden werden." : "Preisstruktur ist vorbereitet, aber nicht scharf geschaltet.",
      nextAction: "Webhook, Customer Mapping und Entitlements-Tabelle ergänzen."
    })
  ];

  const totals = items.reduce(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    {
      ready: 0,
      degraded: 0,
      configured: 0,
      missing_key: 0,
      license_required: 0,
      demo: 0,
      total: items.length
    } satisfies Record<ProviderOperationalStatus, number> & { total: number }
  );
  const readinessScore = Math.round(items.reduce((sum, item) => sum + statusScore[item.status], 0) / items.length);
  const topRisks = items
    .filter((item) => ["missing_key", "demo", "license_required", "degraded"].includes(item.status))
    .sort((a, b) => statusScore[a.status] - statusScore[b.status])
    .slice(0, 4);

  return {
    generatedAt: now.toISOString(),
    readinessScore,
    totals,
    items,
    topRisks,
    nextActions: [
      "Provider-Health im Settings-Kontrollzentrum überwachen.",
      "Live-Pings über /api/providers/ping nutzen, um Latenz, Rate-Limits und Fehler zu messen.",
      "Serverseitige API-Keys nie in NEXT_PUBLIC-Variablen legen.",
      "Mock/Demo-Daten nur mit sichtbarer Kennzeichnung verwenden.",
      "Alert-Ausführung, Billing und mehrere Portfolios erst nach Backend-Gate als aktiv anzeigen."
    ]
  };
}

export function getPublicProviderCapabilityReport(now = new Date()): PublicProviderCapabilityReport {
  const report = getProviderHealthReport(now);
  const categories = Object.entries(categoryLabels).map(([category, label]) => {
    const categoryItems = report.items.filter((item) => item.category === category);
    const configuredCount = categoryItems.filter((item) => item.configured).length;
    const totalCount = categoryItems.length;
    const readinessScore = totalCount
      ? Math.round(categoryItems.reduce((sum, item) => sum + statusScore[item.status], 0) / totalCount)
      : 0;
    const status = worstStatus(categoryItems);

    return {
      id: category as ProviderCategory,
      label,
      status,
      quality: bestQuality(categoryItems),
      configuredCount,
      totalCount,
      readinessScore,
      liveClaim: liveClaimFor(categoryItems),
      capabilities: uniqueLimited(categoryItems.flatMap((item) => item.capabilities), 5),
      limitations: uniqueLimited(categoryItems.flatMap((item) => item.limitations), 4),
      userImpact: uniqueLimited(categoryItems.map((item) => item.userImpact), 2).join(" "),
      nextAction: uniqueLimited(categoryItems.map((item) => item.nextAction), 2).join(" ")
    } satisfies PublicProviderCapability;
  });
  const criticalLimitations = uniqueLimited(
    report.topRisks.flatMap((item) => item.limitations.length ? item.limitations : [item.userImpact]),
    6
  );

  return {
    generatedAt: report.generatedAt,
    readinessScore: report.readinessScore,
    categories,
    criticalLimitations,
    nextActions: report.nextActions.slice(0, 5),
    publicNotice:
      "Diese Übersicht zeigt sichere Capability-Informationen ohne API-Key-Namen oder Secret-Werte. Realtime wird nur behauptet, wenn Provider, Tarif und Lizenz es zulassen."
  };
}

import type { MarketDataQuality } from "@/lib/types";

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

function provider(item: ProviderHealthItem): ProviderHealthItem {
  return item;
}

export function getProviderHealthReport(now = new Date()): ProviderHealthReport {
  const finnhubConfigured = hasEnv("FINNHUB_API_KEY");
  const fmpConfigured = hasEnv("FMP_API_KEY");
  const alphaConfigured = hasEnv("ALPHA_VANTAGE_API_KEY");
  const newsApiConfigured = hasEnv("NEWS_API_KEY") || hasEnv("NEWSAPI_API_KEY");
  const marketauxConfigured = hasEnv("MARKETAUX_API_KEY");
  const supabaseConfigured =
    hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    (hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const supabaseSecretConfigured = hasEnv("SUPABASE_SERVICE_ROLE_KEY") || hasEnv("SUPABASE_SECRET_KEY");
  const sharedCacheConfigured = hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN");
  const aiConfigured = hasEnv("OPENAI_API_KEY") || hasEnv("AI_GATEWAY_API_KEY") || hasEnv("GOOGLE_GENERATIVE_AI_API_KEY");
  const billingConfigured = hasEnv("STRIPE_SECRET_KEY") || hasEnv("LEMONSQUEEZY_API_KEY");

  const items: ProviderHealthItem[] = [
    provider({
      id: "finnhub",
      name: "Finnhub",
      category: "market",
      status: finnhubConfigured ? "configured" : "missing_key",
      quality: qualityFromEnv("FINNHUB_DATA_QUALITY", "near_realtime"),
      configured: finnhubConfigured,
      secretEnv: ["FINNHUB_API_KEY"],
      capabilities: ["Aktien-Quotes", "News", "Fundamentals je nach Plan", "WebSocket je nach Plan"],
      limitations: ["Bid/Ask und Realtime hängen vom Plan und Börsenlizenzen ab", "Rate-Limits im Free/Starter-Bereich"],
      fallback: "FMP, Alpha Vantage oder Mock/Cache mit sichtbarer Kennzeichnung",
      userImpact: finnhubConfigured ? "Marktdaten können providerbasiert geladen werden." : "Kurse fallen auf andere Anbieter, Cache oder Mock zurück.",
      nextAction: finnhubConfigured ? "Plan/Lizenz prüfen und Datenqualität pro Markt festlegen." : "FINNHUB_API_KEY serverseitig in Vercel setzen."
    }),
    provider({
      id: "fmp",
      name: "Financial Modeling Prep",
      category: "fundamentals",
      status: fmpConfigured ? "degraded" : "missing_key",
      quality: qualityFromEnv("FMP_DATA_QUALITY", "delayed"),
      configured: fmpConfigured,
      secretEnv: ["FMP_API_KEY"],
      capabilities: ["Fundamentaldaten", "Financial Statements", "Profile", "Kursdaten je nach Plan"],
      limitations: ["Free-Pläne können stark limitiert sein", "Backoff greift bei 429 Rate-Limits"],
      fallback: "Alpha Vantage, Finnhub oder vorbereitete Datenstruktur",
      userImpact: fmpConfigured ? "Fundamentaldaten sind möglich, aber Rate-Limits werden sichtbar behandelt." : "Tiefe Fundamentaldaten bleiben Demo/vorbereitet.",
      nextAction: "Provider-Coverage je Assetklasse messen und Rate-Limit-Budget sichtbar machen."
    }),
    provider({
      id: "alpha-vantage",
      name: "Alpha Vantage",
      category: "market",
      status: alphaConfigured ? "degraded" : "missing_key",
      quality: qualityFromEnv("ALPHA_VANTAGE_DATA_QUALITY", "delayed"),
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
      status: "ready",
      quality: "near_realtime",
      configured: true,
      secretEnv: [],
      capabilities: ["Krypto-Quotes", "24h Volumen", "nahe Echtzeit je Endpoint", "REST/WebSocket-Struktur vorbereitet"],
      limitations: ["Exchange-Daten sind keine regulierte Börsen-Konsolidierung", "Bid/Ask hängt vom Handelspaar ab"],
      fallback: "Mock/Cache nur mit sichtbarem Badge",
      userImpact: "Krypto kann deutlich näher an Echtzeit laufen als viele kostenlose Aktienfeeds.",
      nextAction: "Subscriptions auf sichtbare Symbole begrenzen und Orderbook-Felder nur bei echten Daten zeigen."
    }),
    provider({
      id: "news",
      name: "NewsAPI / Marketaux",
      category: "news",
      status: newsApiConfigured || marketauxConfigured ? "configured" : "missing_key",
      quality: newsApiConfigured || marketauxConfigured ? "near_realtime" : "mock",
      configured: newsApiConfigured || marketauxConfigured,
      secretEnv: ["NEWS_API_KEY", "NEWSAPI_API_KEY", "MARKETAUX_API_KEY"],
      capabilities: ["Unternehmensnachrichten", "Quellen", "Zeitstempel", "Sentiment/Impact vorbereitet"],
      limitations: ["Lizenzbedingungen und Caching-Regeln beachten", "News dürfen nicht ungeprüft als Fakt verkauft werden"],
      fallback: "Mock-News nur mit klarer Demo-Kennzeichnung",
      userImpact: newsApiConfigured || marketauxConfigured ? "News können mit Quelle und Datum geladen werden." : "News-Terminal bleibt Demo/vorbereitet.",
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
      fallback: "Lokaler Offline-/Demo-Modus",
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
      id: "ai",
      name: "AI Analysis Provider",
      category: "ai",
      status: aiConfigured ? "configured" : "demo",
      quality: aiConfigured ? "near_realtime" : "mock",
      configured: aiConfigured,
      secretEnv: ["OPENAI_API_KEY", "AI_GATEWAY_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
      capabilities: ["KI-Zusammenfassungen", "Bull/Bear/Neutral Cases", "Unsicherheiten", "Datenqualitäts-Hinweise"],
      limitations: ["Nur modellbasierte Einschätzung", "Keine Garantie und keine Anlageberatung"],
      fallback: "Regelbasierte Demo-Analyse mit sichtbarer Kennzeichnung",
      userImpact: aiConfigured ? "KI-Texte können serverseitig erzeugt werden." : "KI-Analyse bleibt Demo/regelleitend.",
      nextAction: "AI-Ausgaben strikt an Quellenstatus und Datenfrische koppeln."
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
      fallback: "Demo-/nicht freigeschaltet Status",
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

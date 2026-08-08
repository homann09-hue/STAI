/**
 * Kennungen der Kursquellen.
 *
 * Bewusst hier und nicht in `market-provider.ts`: die Rangfolge braucht den Typ,
 * darf aber nicht auf den Provider zeigen -- das waere ein Ringschluss.
 */
export type MarketProviderId =
  | "mock"
  | "finnhub"
  | "twelve_data"
  | "eodhd"
  | "massive"
  | "polygon"
  | "fmp"
  | "alpha_vantage"
  | "databento"
  | "binance"
  | "coinbase";

/**
 * Rangfolge der Kursquellen.
 *
 * §21 verlangt Primary, Secondary und Fallback. Bisher gab es nur den ersten:
 * `autoProviderId()` waehlte die erste konfigurierte Quelle und der Rueckfall
 * landete beim Mock. Faellt FMP aus, sah der Nutzer Demodaten statt Finnhub.
 *
 * Diese Datei entscheidet die Reihenfolge — ohne Ein-/Ausgabe, damit sie ohne
 * Netz und ohne Schluessel pruefbar bleibt.
 */

export type QuoteChainEnv = Record<string, string | undefined>;

/**
 * Welcher Schluessel welche Quelle freischaltet.
 *
 * Die Reihenfolge ist die Standardrangfolge und nicht willkuerlich: FMP deckt
 * die meisten Assetklassen ab, Finnhub liefert near-realtime, die uebrigen
 * folgen nach abnehmender Abdeckung. Krypto-Boersen stehen bewusst nicht drin
 * — sie beantworten nur Kryptosymbole und waeren als allgemeiner Rueckfall
 * eine Verschlechterung.
 */
const providerKeys: Array<{ id: MarketProviderId; keys: string[] }> = [
  { id: "fmp", keys: ["FMP_API_KEY"] },
  { id: "finnhub", keys: ["FINNHUB_API_KEY"] },
  { id: "twelve_data", keys: ["TWELVE_DATA_API_KEY", "TWELVEDATA_API_KEY"] },
  { id: "eodhd", keys: ["EODHD_API_KEY"] },
  { id: "massive", keys: ["MASSIVE_API_KEY", "POLYGON_API_KEY"] },
  { id: "alpha_vantage", keys: ["ALPHA_VANTAGE_API_KEY"] }
];

export type QuoteChain = {
  /** Reihenfolge der Versuche. Leer, wenn keine Quelle konfiguriert ist. */
  providers: MarketProviderId[];
  /** True, sobald mindestens zwei echte Quellen zur Verfuegung stehen. */
  hasFailover: boolean;
  /**
   * Warum die Kette so aussieht. Gehoert in den Health-Report, damit niemand
   * eine Ausfallsicherheit annimmt, die es nicht gibt.
   */
  note: string;
};

function isConfigured(env: QuoteChainEnv, keys: string[]) {
  return keys.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function configuredProviders(env: QuoteChainEnv): MarketProviderId[] {
  return providerKeys.filter((entry) => isConfigured(env, entry.keys)).map((entry) => entry.id);
}

/**
 * Baut die Rangfolge.
 *
 * Eine ausdrueckliche Wahl über `MARKET_DATA_PROVIDER` wird respektiert und
 * nach vorne gestellt — aber sie schaltet den Rueckfall nicht ab. Wer eine
 * Quelle bevorzugt, will damit fast nie sagen "und sonst lieber Demodaten".
 *
 * Ausnahme: `mock` ist eine Ansage und keine Bevorzugung. Wer ihn ausdruecklich
 * waehlt, bekommt ihn allein.
 */
export function resolveQuoteChain(env: QuoteChainEnv = process.env): QuoteChain {
  const explicit = (env.MARKET_DATA_PROVIDER ?? env.STOCKPILOT_MARKET_PROVIDER ?? env.STOCKPILOT_QUOTE_PROVIDER)
    ?.trim()
    .toLowerCase();

  if (explicit === "mock") {
    return {
      providers: [],
      hasFailover: false,
      note: "Mock ausdrücklich gewählt. Es werden keine echten Quellen abgefragt."
    };
  }

  const available = configuredProviders(env);

  // Krypto-Boersen brauchen keinen Schluessel. Sie kommen nur zum Zug, wenn sie
  // ausdruecklich gewaehlt wurden -- als allgemeine Kursquelle waeren sie
  // ungeeignet, weil sie nur Kryptosymbole kennen.
  const explicitIsKnown =
    explicit !== undefined && explicit !== "auto" && explicit.length > 0
      ? (explicit as MarketProviderId)
      : null;

  const ordered = explicitIsKnown
    ? [explicitIsKnown, ...available.filter((id) => id !== explicitIsKnown)]
    : available;

  if (ordered.length === 0) {
    return {
      providers: [],
      hasFailover: false,
      note: "Keine Kursquelle konfiguriert. Es werden ausschließlich Demodaten angezeigt."
    };
  }

  if (ordered.length === 1) {
    return {
      providers: ordered,
      hasFailover: false,
      // Ehrlich benannt: eine Rangfolge zwischen einer Quelle und sich selbst
      // ist keine. Faellt sie aus, gibt es keinen echten Ersatz.
      note: `Nur eine Kursquelle konfiguriert (${ordered[0]}). Bei einem Ausfall gibt es keinen echten Ersatz, sondern nur Demodaten.`
    };
  }

  return {
    providers: ordered,
    hasFailover: true,
    note: `Rangfolge: ${ordered.join(" → ")}. Bei Ausfall wird die nächste Quelle versucht, bevor auf Demodaten zurückgefallen wird.`
  };
}

/** Der bevorzugte Anbieter, oder null wenn keiner konfiguriert ist. */
export function primaryQuoteProvider(env: QuoteChainEnv = process.env): MarketProviderId | null {
  return resolveQuoteChain(env).providers[0] ?? null;
}

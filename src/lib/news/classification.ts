/**
 * Einordnung von Nachrichten.
 *
 * §27 verlangt zweierlei: Nachrichten nach Bezug ordnen (Unternehmen, Branche,
 * Land, Index, Rohstoff, Währung, Krypto) und Ereignisarten erkennen.
 *
 * **Was das hier ist und was nicht:** ein Schlagwortklassifikator. Er liest
 * keine Nachricht, er erkennt Formulierungen. Deshalb trägt jede Einordnung
 * den Wortlaut mit, der sie ausgelöst hat — ohne diesen Beleg wäre es eine
 * Black Box, und §104 verbietet das. Wer sieht, dass „Übernahme" wegen des
 * Wortes „acquires" vergeben wurde, kann den Fehlschluss selbst erkennen.
 *
 * Die zweite Regel: **kein Auffangwert.** Passt kein Muster, kommt eine leere
 * Liste zurück und keine Kategorie „Sonstiges" — die sähe aus wie eine
 * Einordnung und wäre keine.
 *
 * Reine Rechnung auf Text, kein Netzzugriff.
 */

export type NewsEventType =
  | "earnings"
  | "guidance"
  | "profit_warning"
  | "analyst_change"
  | "acquisition"
  | "merger"
  | "capital_measure"
  | "buyback"
  | "dividend_change"
  | "management_change"
  | "insider_transaction"
  | "sec_filing"
  | "litigation"
  | "regulatory_decision"
  | "product_launch"
  | "supply_chain"
  | "major_contract"
  | "partnership";

export const newsEventLabels: Record<NewsEventType, string> = {
  earnings: "Quartalszahlen",
  guidance: "Prognose",
  profit_warning: "Gewinnwarnung",
  analyst_change: "Analystenänderung",
  acquisition: "Übernahme",
  merger: "Fusion",
  capital_measure: "Kapitalmaßnahme",
  buyback: "Aktienrückkauf",
  dividend_change: "Dividendenänderung",
  management_change: "Managementwechsel",
  insider_transaction: "Insidertransaktion",
  sec_filing: "SEC-Filing",
  litigation: "Rechtsstreit",
  regulatory_decision: "Regulatorische Entscheidung",
  product_launch: "Produkteinführung",
  supply_chain: "Lieferkette",
  major_contract: "Großauftrag",
  partnership: "Partnerschaft"
};

type EventPattern = {
  type: NewsEventType;
  pattern: RegExp;
  /**
   * Muster, die eine Einordnung wieder zurücknehmen.
   *
   * Der Grund ist der häufigste Fehler eines Schlagwortklassifikators: das
   * Stichwort steht da, meint aber etwas anderes. „Dividend yield of 3 %" ist
   * keine Dividendenänderung, „merger arbitrage fund" keine Fusion.
   */
  unless?: RegExp;
};

const eventPatterns: EventPattern[] = [
  {
    type: "earnings",
    pattern:
      /\b(q[1-4]|first|second|third|fourth)[- ]?(quarter)?\s*(results|earnings|report)|\bearnings (report|call|results|beat|miss)|\bquartalszahlen|\bquartalsbericht|\bjahreszahlen\b/i,
    // Ein Termin ist noch keine Meldung von Zahlen.
    unless: /\bearnings (date|preview|expectations|season)\b|\bahead of (its |the )?earnings\b/i
  },
  {
    type: "guidance",
    // Die Qualifizierer sind wiederholbar: "raises its full-year guidance" hat
    // zwei davon. Beim ersten Versuch liess das Muster nur einen zu und
    // uebersah genau diese haeufigste Formulierung.
    pattern:
      /\b(raises?|lifts?|lowers?|cuts?|updates?|reaffirms?|maintains?|issues?)\s+((its|the|full[- ]year|fy\s*\d*|\d{4})\s+)*(guidance|outlook|forecast)\b|\bprognose (angehoben|gesenkt|bestätigt|erhöht)\b|\b(hebt|senkt|bestätigt|kappt)\b[^.]{0,30}\bprognose\b/i
  },
  {
    type: "profit_warning",
    pattern: /\bprofit warning|\bwarns? (on|of|about) (profit|earnings|results)|\bgewinnwarnung|\bcuts? (its )?(profit|earnings) (forecast|outlook)\b/i
  },
  {
    type: "analyst_change",
    pattern:
      /\b(upgrades?|downgrades?|initiates? coverage|reiterates?|raises? (its )?price target|lowers? (its )?price target|kursziel|hochgestuft|herabgestuft)\b/i,
    // "upgrade" trifft auch auf Software zu -- dort ist es kein Analystenurteil.
    unless: /\b(software|firmware|hardware|system|app|os|version) upgrade|upgrade (your|to) (the )?(app|plan|version)\b/i
  },
  {
    type: "acquisition",
    pattern: /\b(acquires?|acquisition of|to acquy?ire|buys? out|takeover (bid|offer)|übernimmt|übernahme(angebot)?)\b/i,
    unless: /\bcustomer acquisition|\buser acquisition|\btalent acquisition|\bacquisition cost/i
  },
  {
    type: "merger",
    pattern: /\bmergers?\b|\bto merge with\b|\bfusion(iert)?\b|\bzusammenschluss\b/i,
    // "M&A"-Fonds und -Anwaelte sind keine Fusion.
    unless: /\bmerger arbitrage|\bm&a (fund|advisor|lawyer|practice|market)/i
  },
  {
    type: "capital_measure",
    pattern:
      /\b(capital (increase|raise)|rights issue|secondary offering|share (issue|placement)|convertible (note|bond) offering|kapitalerhöhung|bezugsrecht|anleiheemission)\b/i
  },
  {
    type: "buyback",
    pattern: /\b(share |stock )?(buyback|repurchase) (program|plan|authorization)?|\brückkaufprogramm|\baktienrückkauf\b/i
  },
  {
    type: "dividend_change",
    // Der Kern: eine Dividende allein ist keine Aenderung. Es braucht ein
    // Aenderungswort, sonst waere jede Renditeangabe eine Meldung.
    pattern:
      /\bdividend\b[^.]{0,40}\b(raise[sd]?|increase[sd]?|hike[sd]?|cut[s]?|slash(es|ed)?|suspend(s|ed)?|reinstate[sd]?|declare[sd]?|boost(s|ed)?)\b|\b(raise[sd]?|increase[sd]?|cut[s]?|suspend(s|ed)?)\b[^.]{0,25}\bdividend\b|\bdividende (erhöht|gesenkt|gestrichen|angehoben)\b/i,
    unless: /\bdividend yield of|\bdividend (stocks?|aristocrats?|etf|screener|calendar)\b/i
  },
  {
    type: "management_change",
    pattern:
      /\b(ceo|cfo|coo|cto|chairman|chief executive|chief financial)\b[^.]{0,50}\b(steps? down|resigns?|departs?|to leave|appointed|named|succeeds?|hire[sd]?|ousted|fired)\b|\bnames? (new )?(ceo|cfo|coo|cto)\b|\b(vorstands|ceo)wechsel\b/i
  },
  {
    type: "insider_transaction",
    pattern:
      /\binsider (buying|selling|transaction|trade)s?\b|\b(ceo|cfo|director|executive|officer)\b[^.]{0,40}\b(sells?|sold|buys?|bought|purchases?)\b[^.]{0,30}\bshares?\b|\bform 4\b|\binsidergeschäft/i
  },
  {
    type: "sec_filing",
    pattern: /\bsec filing\b|\bfiles? (a |an )?(10-[kq]|8-k|s-1|13[dfg]|form \d)\b|\b(10-[kq]|8-k|13[dfg]) filing\b|\bfiled with the sec\b/i
  },
  {
    type: "litigation",
    pattern:
      /\blawsuits?\b|\bsue[sd]?\b|\bsuing\b|\blitigation\b|\bclass action\b|\bcourt (ruling|ordered|filing)\b|\bsettle[sd]? (a |the )?(claim|suit|lawsuit)\b|\bklage\b|\brechtsstreit\b/i
  },
  {
    type: "regulatory_decision",
    pattern:
      /\b(fda|ftc|sec|doj|eu commission|european commission|regulators?|antitrust|cma|bafin)\b[^.]{0,60}\b(approve[sd]?|reject(s|ed)?|block(s|ed)?|fine[sd]?|clears?|probe[sd]?|investigat(es|ed|ion)|ruling)\b|\bregulatory (approval|decision|clearance)\b|\bkartellamt|\bgenehmigung erteilt\b/i
  },
  {
    type: "product_launch",
    pattern:
      /\b(launch(es|ed)?|unveil(s|ed)?|introduce[sd]?|debuts?|releases?|rolls? out)\b[^.]{0,45}\b(product|device|model|chip|service|platform|app|vehicle|drug|phone|feature)\b|\bproduktein(führung|start)\b|\bvorgestellt\b/i,
    // Eine Ankuendigung einer Ankuendigung ist keine Einfuehrung.
    unless: /\bexpected to (launch|unveil)|\brumor(ed|s)?\b|\bleaks?\b/i
  },
  {
    type: "supply_chain",
    pattern:
      /\bsupply chain\b|\b(chip|component|parts?|semiconductor) shortage\b|\bproduction (halt|cut|delay|disruption)\b|\bfactory (shutdown|fire|closure)\b|\blieferkette|\bproduktionsstopp|\bengpass\b/i
  },
  {
    type: "major_contract",
    pattern:
      /\b(wins?|awarded|secures?|lands?|signs?)\b[^.]{0,40}\b(contract|order|deal|tender)\b|\bcontract worth\b|\bgroßauftrag|\bauftrag (erhalten|gewonnen)\b/i,
    unless: /\bcontract (expires?|ends?|terminated)\b/i
  },
  {
    type: "partnership",
    pattern:
      /\b(partners? with|partnership with|teams? up with|joint venture|collaborat(es|ed|ion) with|alliance with)\b|\bpartnerschaft mit\b|\bkooperation mit\b/i
  }
];

export type DetectedEvent = {
  type: NewsEventType;
  label: string;
  /**
   * Der Wortlaut, der die Einordnung ausgelöst hat.
   *
   * Pflichtfeld und nicht optional: ohne ihn ließe sich eine
   * Fehlklassifikation nicht erkennen.
   */
  matchedText: string;
};

/**
 * Erkennt Ereignisarten in Titel und Zusammenfassung.
 *
 * Mehrfachtreffer sind erlaubt und richtig — eine Meldung kann Quartalszahlen
 * **und** eine Prognoseänderung enthalten. Ohne Treffer bleibt die Liste leer.
 */
export function detectEvents(title: string, summary = ""): DetectedEvent[] {
  const text = `${title}. ${summary}`.replace(/\s+/g, " ").trim();
  if (!text) return [];

  return eventPatterns.flatMap((entry) => {
    const match = entry.pattern.exec(text);
    if (!match) return [];
    if (entry.unless?.test(text)) return [];

    return [
      {
        type: entry.type,
        label: newsEventLabels[entry.type],
        matchedText: match[0].trim().slice(0, 80)
      }
    ];
  });
}

export type NewsSubjectType = "company" | "industry" | "country" | "index" | "commodity" | "currency" | "crypto";

export type NewsSubject = {
  type: NewsSubjectType;
  /** Stabiler Schlüssel, etwa das Symbol oder das Länderkürzel. */
  id: string;
  label: string;
  /**
   * Woher der Bezug stammt.
   *
   * `provider` ist belastbar — der Anbieter hat die Entität selbst erkannt.
   * `symbol` ist abgeleitet. Der Unterschied gehört sichtbar bleiben, weil er
   * über die Verlässlichkeit entscheidet.
   */
  origin: "provider" | "symbol";
  /** Wie stark der Anbieter den Bezug gewichtet, falls angegeben. */
  matchScore: number | null;
};

/** Eine Entität, wie sie ein Nachrichtenanbieter liefert. */
export type ProviderEntity = {
  symbol?: string | null;
  name?: string | null;
  type?: string | null;
  industry?: string | null;
  country?: string | null;
  matchScore?: number | null;
};

const countryNames: Record<string, string> = {
  us: "USA",
  de: "Deutschland",
  gb: "Vereinigtes Königreich",
  fr: "Frankreich",
  ca: "Kanada",
  cn: "China",
  jp: "Japan",
  in: "Indien",
  ch: "Schweiz",
  nl: "Niederlande",
  au: "Australien",
  kr: "Südkorea",
  br: "Brasilien",
  it: "Italien",
  es: "Spanien"
};

const commoditySymbols: Record<string, string> = {
  GCUSD: "Gold",
  SIUSD: "Silber",
  BZUSD: "Brent-Öl",
  CLUSD: "WTI-Öl",
  NGUSD: "Erdgas",
  HGUSD: "Kupfer"
};

const currencyPattern = /^(EUR|USD|GBP|JPY|CHF|CAD|AUD|CNY|SEK|NOK)(USD|EUR|GBP|JPY|CHF|CAD|AUD|CNY|X)$/i;
const cryptoPattern = /^(BTC|ETH|SOL|XRP|ADA|DOGE|DOT|AVAX|LTC|BCH|LINK|MATIC)([-/]?USD[T]?)?$/i;

function classifySymbol(symbol: string): { type: NewsSubjectType; label: string } | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized.startsWith("^")) return { type: "index", label: normalized.slice(1) };
  if (commoditySymbols[normalized]) return { type: "commodity", label: commoditySymbols[normalized] };
  if (cryptoPattern.test(normalized)) return { type: "crypto", label: normalized.replace(/[-/]?USDT?$/i, "") };
  if (currencyPattern.test(normalized)) return { type: "currency", label: normalized };

  return { type: "company", label: normalized };
}

/**
 * Ordnet eine Nachricht ihren Bezügen zu.
 *
 * Grundlage sind die Entitäten des Anbieters, nicht der Fließtext. Branche und
 * Land aus einem Titel zu raten wäre eine Erfindung — hier steht deshalb nur,
 * was der Anbieter tatsächlich mitgeliefert hat. Fehlt die Angabe, fehlt der
 * Bezug.
 */
export function classifySubjects(entities: readonly ProviderEntity[], fallbackSymbol?: string): NewsSubject[] {
  const subjects = new Map<string, NewsSubject>();

  const add = (subject: NewsSubject) => {
    const key = `${subject.type}:${subject.id.toUpperCase()}`;
    const existing = subjects.get(key);
    // Bei Doppelnennung gewinnt der hoehere Match-Score und der belastbarere
    // Ursprung.
    if (!existing || (subject.matchScore ?? 0) > (existing.matchScore ?? 0)) subjects.set(key, subject);
  };

  for (const entity of entities) {
    const symbol = entity.symbol?.trim();
    const matchScore = typeof entity.matchScore === "number" && Number.isFinite(entity.matchScore) ? entity.matchScore : null;

    if (symbol) {
      const classified = classifySymbol(symbol);
      if (classified) {
        add({
          type: classified.type,
          id: symbol.toUpperCase(),
          label: entity.name?.trim() || classified.label,
          origin: "provider",
          matchScore
        });
      }
    }

    const industry = entity.industry?.trim();
    if (industry) {
      add({ type: "industry", id: industry.toLowerCase(), label: industry, origin: "provider", matchScore });
    }

    const country = entity.country?.trim().toLowerCase();
    if (country) {
      add({
        type: "country",
        id: country,
        label: countryNames[country] ?? country.toUpperCase(),
        origin: "provider",
        matchScore
      });
    }
  }

  // Nur wenn der Anbieter gar nichts erkannt hat, wird auf das abgefragte
  // Symbol zurueckgegriffen -- und das wird als abgeleitet gekennzeichnet.
  if (subjects.size === 0 && fallbackSymbol) {
    const classified = classifySymbol(fallbackSymbol);
    if (classified) {
      add({
        type: classified.type,
        id: fallbackSymbol.toUpperCase(),
        label: classified.label,
        origin: "symbol",
        matchScore: null
      });
    }
  }

  return [...subjects.values()].sort((left, right) => (right.matchScore ?? 0) - (left.matchScore ?? 0));
}

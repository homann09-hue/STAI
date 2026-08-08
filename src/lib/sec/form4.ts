/**
 * Form 4 — Insidertransaktionen aus der Primärquelle.
 *
 * §32 verlangt Person, Position, Kauf/Verkauf, Stückzahl, Preis, Wert und
 * Datum — und dann den entscheidenden Satz: „Unterscheide echte
 * Open-Market-Käufe von Compensation, Optionsausübung, automatischen
 * Verkaufsprogrammen."
 *
 * Das ist keine Darstellungsfrage, sondern der Unterschied zwischen einer
 * Aussage und ihrem Gegenteil. Ein gemessenes Beispiel, Apple, 2026-06-15:
 *
 * ```
 * Newstead Jennifer, SVP, GC and Secretary
 *   Code M   +30.104 Aktien
 *   Code F   −16.238 Aktien zu 296,42 $
 * ```
 *
 * Ein naives Modell liest „30.104 Aktien erworben" und meldet einen Insiderkauf.
 * Tatsächlich hat niemand etwas gekauft: `M` ist die Ausübung zugeteilter
 * Optionen, `F` die sofortige Rückgabe von Anteilen zur Steuerzahlung. Der
 * bisherige Typ `{ action: "Buy" | "Sell" }` konnte diesen Fall gar nicht
 * abbilden.
 *
 * **Ein echter Kauf ist Code `P`.** Nur er bedeutet, dass jemand eigenes Geld
 * zum Marktpreis eingesetzt hat.
 *
 * Reine Auswertung, kein Netzzugriff.
 */

export type InsiderTransactionKind =
  | "open_market_buy"
  | "open_market_sell"
  | "compensation"
  | "option_exercise"
  | "tax_withholding"
  | "gift_or_inheritance"
  | "other";

/**
 * Die Transaktionscodes der SEC (Tabelle I/II des Formulars 345).
 *
 * Jeder Code trägt seine Erklärung mit — §104 verbietet die Black Box, und ein
 * einzelner Großbuchstabe ist die reinste Form davon.
 */
export const transactionCodes: Record<string, { kind: InsiderTransactionKind; label: string }> = {
  P: { kind: "open_market_buy", label: "Kauf über den Markt" },
  S: { kind: "open_market_sell", label: "Verkauf über den Markt" },
  A: { kind: "compensation", label: "Zuteilung als Vergütung" },
  D: { kind: "compensation", label: "Rückgabe an das Unternehmen" },
  F: { kind: "tax_withholding", label: "Anteile zur Steuerzahlung einbehalten" },
  I: { kind: "other", label: "Transaktion im Rahmen eines Plans (16b-3(f))" },
  M: { kind: "option_exercise", label: "Ausübung zugeteilter Optionen" },
  C: { kind: "option_exercise", label: "Wandlung eines Derivats" },
  X: { kind: "option_exercise", label: "Ausübung eines Derivats im Geld" },
  O: { kind: "option_exercise", label: "Ausübung eines Derivats aus dem Geld" },
  E: { kind: "other", label: "Verfall einer kurzen Derivateposition" },
  H: { kind: "other", label: "Verfall einer langen Derivateposition" },
  G: { kind: "gift_or_inheritance", label: "Schenkung" },
  W: { kind: "gift_or_inheritance", label: "Erwerb oder Abgabe von Todes wegen" },
  L: { kind: "other", label: "Kleinerwerb" },
  Z: { kind: "other", label: "Ein- oder Auszahlung aus einem Stimmrechtstreuhandverhältnis" },
  J: { kind: "other", label: "Sonstiger Erwerb oder sonstige Abgabe" },
  K: { kind: "other", label: "Equity-Swap-Geschäft" },
  U: { kind: "other", label: "Abgabe im Rahmen eines Übernahmeangebots" },
  V: { kind: "other", label: "Freiwillig vorzeitig gemeldet" }
};

export type InsiderTransaction = {
  /** Wer. */
  person: string;
  /** Welche Position — leer, wenn die Meldung keine nennt. */
  position: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  date: string;
  /** Der rohe Code, damit die Einordnung nachprüfbar bleibt. */
  code: string;
  kind: InsiderTransactionKind;
  /** Was der Code bedeutet, in einem Satz. */
  codeLabel: string;
  /** Erworben oder abgegeben. */
  direction: "acquired" | "disposed";
  shares: number | null;
  /** Preis je Stück. `null` bei Zuteilungen — dort gibt es keinen. */
  pricePerShare: number | null;
  /** Stück mal Preis. `null`, wenn einer von beiden fehlt. */
  value: number | null;
  sharesOwnedAfter: number | null;
  /**
   * Ob die Transaktion aus einem vorab festgelegten Plan nach Rule 10b5-1
   * stammt.
   *
   * §32 nennt „automatische Verkaufsprogramme" ausdrücklich, und der Grund ist
   * inhaltlich: ein Verkauf aus einem Monate zuvor aufgesetzten Plan ist kein
   * Signal über die heutige Einschätzung des Insiders.
   */
  isPlanned: boolean;
};

/**
 * Die Position in einem Satz.
 *
 * §32 verlangt sie ausdrücklich. `officerTitle` ist nur bei Vorständen gefüllt
 * — ein Aufsichtsratsmitglied hätte sonst gar keine Position, obwohl seine
 * Rolle gemeldet ist. An echten Apple-Daten betraf das den Verkäufer der mit
 * Abstand größten Position des Zeitraums.
 */
export function insiderRole(transaction: InsiderTransaction): string {
  if (transaction.position) return transaction.position;

  const roles = [
    transaction.isDirector ? "Verwaltungsrat" : null,
    transaction.isOfficer ? "Führungskraft" : null,
    transaction.isTenPercentOwner ? "Großaktionär über 10 %" : null
  ].filter((role): role is string => role !== null);

  return roles.length ? roles.join(", ") : "Position nicht angegeben";
}

export type Form4Filing = {
  issuer: string | null;
  issuerSymbol: string | null;
  person: string;
  transactions: InsiderTransaction[];
};

function tag(name: string, source: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(source);
  return match ? match[1].trim() : null;
}

/** Form 4 verschachtelt Werte in `<value>`. Ohne diese Ebene liest man den Rohblock. */
function tagValue(name: string, source: string): string | null {
  const block = tag(name, source);
  if (block === null) return null;
  const inner = tag("value", block);
  return (inner ?? block).trim() || null;
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isTrue(value: string | null) {
  return value === "1" || value?.toLowerCase() === "true";
}

/**
 * Wertet eine Form-4-Meldung aus.
 *
 * Bewusst ohne XML-Bibliothek: es werden feste, flache Elemente gelesen, und
 * eine zusätzliche Abhängigkeit für zwanzig Feldnamen wäre nicht zu
 * rechtfertigen.
 *
 * Derivate-Transaktionen (`derivativeTransaction`) werden **mitgelesen**. Ohne
 * sie fehlte die Optionsausübung selbst und man sähe nur ihre Folgen.
 */
export function parseForm4(xml: string): Form4Filing | null {
  if (!xml || !/<ownershipDocument/i.test(xml)) return null;

  const ownerBlock = tag("reportingOwner", xml) ?? xml;
  const person = tagValue("rptOwnerName", ownerBlock) ?? tag("rptOwnerName", xml);
  if (!person) return null;

  const relationship = tag("reportingOwnerRelationship", ownerBlock) ?? "";
  const isDirector = isTrue(tag("isDirector", relationship));
  const isOfficer = isTrue(tag("isOfficer", relationship));
  const isTenPercentOwner = isTrue(tag("isTenPercentOwner", relationship));
  const position = tag("officerTitle", relationship)?.trim() || null;

  // Rule 10b5-1 steht je nach Formularfassung in einem eigenen Feld oder nur
  // im Fussnotentext. Beides wird geprueft -- die Angabe nur an einer Stelle
  // zu suchen hiesse, geplante Verkaeufe je nach Alter der Meldung zu
  // uebersehen.
  const planFlag = isTrue(tagValue("aff10b5One", xml));
  const planInFootnote = /10b5-1/i.test(xml);
  const isPlanned = planFlag || planInFootnote;

  const blocks = [
    ...(xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/gi) ?? []),
    ...(xml.match(/<derivativeTransaction>[\s\S]*?<\/derivativeTransaction>/gi) ?? [])
  ];

  const transactions = blocks.flatMap((block): InsiderTransaction[] => {
    const code = (tagValue("transactionCode", block) ?? "").toUpperCase();
    const date = tagValue("transactionDate", block);
    if (!code || !date) return [];

    const known = transactionCodes[code];
    const shares = toNumber(tagValue("transactionShares", block));
    const pricePerShare = toNumber(tagValue("transactionPricePerShare", block));
    const acquiredDisposed = (tagValue("transactionAcquiredDisposedCode", block) ?? "").toUpperCase();

    return [
      {
        person,
        position,
        isDirector,
        isOfficer,
        isTenPercentOwner,
        date,
        code,
        // Ein unbekannter Code wird als unbekannt gemeldet und nicht in
        // "Sonstiges" einsortiert -- sonst saehe eine Luecke im Katalog wie
        // eine Einordnung aus.
        kind: known?.kind ?? "other",
        codeLabel: known?.label ?? `Unbekannter Code ${code}`,
        direction: acquiredDisposed === "D" ? "disposed" : "acquired",
        shares,
        // Ein Preis von 0 ist bei Zuteilungen die Regel und bedeutet "kein
        // Preis", nicht "kostenlos gekauft".
        pricePerShare: pricePerShare && pricePerShare > 0 ? pricePerShare : null,
        value:
          shares !== null && pricePerShare !== null && pricePerShare > 0
            ? Number((shares * pricePerShare).toFixed(2))
            : null,
        sharesOwnedAfter: toNumber(tagValue("sharesOwnedFollowingTransaction", block)),
        isPlanned
      }
    ];
  });

  return {
    issuer: tagValue("issuerName", xml),
    issuerSymbol: tagValue("issuerTradingSymbol", xml),
    person,
    transactions
  };
}

export type InsiderSummary = {
  /** Nur Code P: eigenes Geld, Marktpreis. */
  openMarketBuys: number;
  openMarketSells: number;
  /** Summe der Käufe über den Markt in Währungseinheiten. */
  buyValue: number;
  sellValue: number;
  /** Transaktionen, die keine Marktentscheidung sind. */
  compensationCount: number;
  optionExerciseCount: number;
  /** Geplante Transaktionen aller Art. */
  plannedCount: number;
  /** Geplante **Markt**transaktionen. Nur diese entkräften ein Marktsignal. */
  plannedMarketCount: number;
  /** Ob überhaupt eine Marktentscheidung vorliegt. */
  hasMarketActivity: boolean;
  interpretation: string;
};

/**
 * Fasst zusammen — und zwar so, dass die Zusammenfassung nicht mehr behauptet
 * als die Daten hergeben.
 *
 * Der übliche Fehler ist, alle Erwerbe zu addieren und „Insider kaufen" zu
 * melden. Zuteilungen und Optionsausübungen werden deshalb getrennt gezählt
 * und **nicht** in die Kaufsumme eingerechnet.
 */
export function summarizeInsiderActivity(transactions: readonly InsiderTransaction[]): InsiderSummary {
  const buys = transactions.filter((entry) => entry.kind === "open_market_buy");
  const sells = transactions.filter((entry) => entry.kind === "open_market_sell");
  const compensation = transactions.filter(
    (entry) => entry.kind === "compensation" || entry.kind === "tax_withholding"
  );
  const exercises = transactions.filter((entry) => entry.kind === "option_exercise");
  const planned = transactions.filter((entry) => entry.isPlanned);

  const sum = (entries: readonly InsiderTransaction[]) =>
    Number(entries.reduce((total, entry) => total + (entry.value ?? 0), 0).toFixed(2));

  const marketTransactions = [...buys, ...sells];
  // Nur die geplanten **Markt**transaktionen zaehlen fuer diese Aussage.
  //
  // Der erste Entwurf verglich `planned.length` -- alle Arten -- mit der Zahl
  // der Markttransaktionen. An echten Apple-Daten stimmten beide zufaellig bei
  // 6 ueberein, und die Zusammenfassung meldete "alle aus vorab festgelegten
  // Plaenen", obwohl drei Verkaeufe ueber 86,7 Mio. $ **ohne** Planhinweis
  // darunter waren. Ein Zahlenzufall haette damit eine Falschaussage ueber die
  // groesste Position des Zeitraums erzeugt.
  const plannedMarket = marketTransactions.filter((entry) => entry.isPlanned);
  const hasMarketActivity = marketTransactions.length > 0;

  const interpretation = !transactions.length
    ? "Keine gemeldeten Transaktionen im betrachteten Zeitraum."
    : !hasMarketActivity
      ? `Keine Käufe oder Verkäufe über den Markt. Die ${transactions.length} gemeldeten Vorgänge sind Zuteilungen, Optionsausübungen oder Steuereinbehalte — sie sagen nichts über die Einschätzung der Insider aus.`
      : plannedMarket.length === marketTransactions.length
        ? "Alle Markttransaktionen stammen aus vorab festgelegten Plänen (Rule 10b5-1). Sie wurden Monate im Voraus terminiert und sind kein Hinweis auf die heutige Einschätzung."
        : `${buys.length} Käufe und ${sells.length} Verkäufe über den Markt, davon ${plannedMarket.length} aus vorab festgelegten Plänen. Käufe mit eigenem Geld sind aussagekräftiger als Verkäufe, für die es viele Gründe außerhalb der Unternehmensbewertung gibt.`;

  return {
    openMarketBuys: buys.length,
    openMarketSells: sells.length,
    buyValue: sum(buys),
    sellValue: sum(sells),
    compensationCount: compensation.length,
    optionExerciseCount: exercises.length,
    plannedCount: planned.length,
    plannedMarketCount: plannedMarket.length,
    hasMarketActivity,
    interpretation
  };
}

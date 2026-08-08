/**
 * Bewertungsmodelle.
 *
 * §37 verlangt mehrere Methoden und für den DCF ausdrücklich: „Annahmen,
 * Discount Rate, Wachstum, Terminal Growth, Sensitivitätsanalyse". §38 ergänzt
 * die Regel, die hier alles bestimmt: **keine Scheingenauigkeit.**
 *
 * > Besser: Base Case 145–170 € — statt: Ziel 163,27 €
 *
 * Ein DCF erzeugt aus grob geschätzten Annahmen eine Zahl mit zwei
 * Nachkommastellen. Das ist seine gefährlichste Eigenschaft: das Ergebnis sieht
 * genauer aus als jede einzelne Eingabe. Deshalb gibt `discountedCashFlow`
 * **immer eine Spanne** aus der Sensitivitätsrechnung zurück, nie einen
 * Punktwert allein.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

export type DcfAssumptions = {
  /** Freier Cashflow des letzten Jahres, in Währungseinheiten. */
  freeCashFlow: number;
  sharesOutstanding: number;
  /**
   * Nettoverschuldung: Schulden minus liquide Mittel. Negativ bei Nettoliquidität.
   *
   * **Falle mit Folgen.** Die Versuchung ist groß, sie als
   * `enterpriseValue − marketCap` abzuleiten. Das geht schief, sobald beide aus
   * verschiedenen Zeitständen stammen: bei einer Probe mit echten Apple-Daten
   * ergab der Unternehmenswert des Geschäftsjahres 2025 gegen die heutige
   * Marktkapitalisierung eine Nettoliquidität von 707 Mrd. $ — um mehr als
   * eine Größenordnung zu hoch.
   *
   * §22 verbietet das Vermischen von Stichtagen genau deshalb. Die
   * Nettoverschuldung gehört aus der Bilanz, nicht aus einer Differenz zweier
   * Größen mit unterschiedlichem Datum.
   */
  netDebt: number;
  /** Erwartetes jährliches Wachstum in der Prognosephase, als Anteil (0,08 = 8 %). */
  growthRate: number;
  /** Ewiges Wachstum danach. Muss unter dem Diskontsatz liegen. */
  terminalGrowth: number;
  /** Kapitalkosten, als Anteil. */
  discountRate: number;
  /** Länge der Prognosephase in Jahren. */
  years: number;
};

export type DcfFailure = { ok: false; reason: string };

export type DcfValuation = {
  ok: true;
  /** Rechnerischer Wert je Aktie — **nie allein zu zeigen**, immer mit `range`. */
  fairValuePerShare: number;
  equityValue: number;
  enterpriseValue: number;
  presentValueOfForecast: number;
  presentValueOfTerminal: number;
  /**
   * Anteil des Terminal Value am Gesamtwert.
   *
   * Die ehrlichste Zahl des ganzen Modells. Liegt sie über 75 %, stammt der
   * Wert fast vollständig aus einer Annahme über die Ewigkeit — die
   * Prognosephase ist dann Beiwerk.
   */
  terminalShare: number;
  assumptions: DcfAssumptions;
  caveats: string[];
};

export type DcfResult = DcfValuation | DcfFailure;

/**
 * Ab welchem Terminalanteil gewarnt wird.
 *
 * Zunächst auf 0,75 gesetzt — bis eine Messung zeigte, dass das die Hälfte
 * aller normalen Bewertungen trifft:
 *
 * ```
 *  5 Jahre, r= 7 %: 80,6 %      10 Jahre, r= 7 %: 68,0 %
 *  5 Jahre, r= 9 %: 74,1 %      10 Jahre, r= 9 %: 58,3 %
 *  5 Jahre, r=11 %: 68,2 %      10 Jahre, r=11 %: 50,0 %
 * ```
 *
 * Ein Hinweis, der bei jeder zweiten Rechnung erscheint, wird überlesen. Bei
 * 85 % trägt die Prognosephase weniger als ein Sechstel bei und ist wirklich
 * nur noch Beiwerk — dort ist die Warnung eine Auskunft und kein Rauschen.
 *
 * Der Anteil selbst steht unabhängig davon **immer** im Ergebnis.
 */
const TERMINAL_SHARE_WARNING = 0.85;

function isPositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

/**
 * Discounted Cash Flow nach dem Zwei-Phasen-Modell.
 *
 * Verweigert die Rechnung, statt eine unsinnige Zahl zu liefern:
 *
 * - **Terminal Growth ≥ Diskontsatz** ist der klassische Fehler. Die
 *   Gordon-Formel teilt durch `(r − g)`; wird der Nenner null oder negativ,
 *   entsteht ein unendlicher oder negativer Unternehmenswert. Ein Unternehmen,
 *   das ewig schneller wächst als der Kapitalmarkt kostet, wäre irgendwann die
 *   gesamte Weltwirtschaft.
 * - **Negativer freier Cashflow** lässt sich nicht sinnvoll fortschreiben.
 *   Ein DCF auf einem Verlustbringer multipliziert den Verlust.
 */
export function discountedCashFlow(assumptions: DcfAssumptions): DcfResult {
  const { freeCashFlow, sharesOutstanding, netDebt, growthRate, terminalGrowth, discountRate, years } =
    assumptions;

  if (!isPositive(freeCashFlow)) {
    return {
      ok: false,
      reason:
        "Der freie Cashflow ist null oder negativ. Ein DCF würde diesen Wert fortschreiben und wäre damit keine Bewertung, sondern eine Hochrechnung des Verlusts."
    };
  }
  if (!isPositive(sharesOutstanding)) {
    return { ok: false, reason: "Die Aktienzahl fehlt. Ohne sie lässt sich kein Wert je Aktie bilden." };
  }
  if (!isPositive(discountRate)) {
    return { ok: false, reason: "Der Diskontsatz muss größer als null sein." };
  }
  if (!Number.isFinite(terminalGrowth) || terminalGrowth >= discountRate) {
    return {
      ok: false,
      reason: `Das ewige Wachstum (${(terminalGrowth * 100).toFixed(1)} %) liegt nicht unter dem Diskontsatz (${(discountRate * 100).toFixed(1)} %). Der Endwert wäre unendlich oder negativ — ein Unternehmen, das dauerhaft schneller wächst als der Kapitalmarkt kostet, wäre irgendwann die gesamte Wirtschaft.`
    };
  }
  if (!Number.isInteger(years) || years < 1 || years > 20) {
    return { ok: false, reason: "Die Prognosephase muss zwischen 1 und 20 Jahren liegen." };
  }

  let presentValueOfForecast = 0;
  let lastCashFlow = freeCashFlow;

  for (let year = 1; year <= years; year += 1) {
    lastCashFlow = lastCashFlow * (1 + growthRate);
    presentValueOfForecast += lastCashFlow / (1 + discountRate) ** year;
  }

  // Gordon-Wachstumsmodell auf den Cashflow des ersten Jahres nach der
  // Prognosephase, abgezinst auf heute.
  const terminalValue = (lastCashFlow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const presentValueOfTerminal = terminalValue / (1 + discountRate) ** years;

  const enterpriseValue = presentValueOfForecast + presentValueOfTerminal;
  const equityValue = enterpriseValue - netDebt;
  const terminalShare = enterpriseValue === 0 ? 0 : presentValueOfTerminal / enterpriseValue;

  const caveats: string[] = [];

  if (terminalShare > TERMINAL_SHARE_WARNING) {
    caveats.push(
      `${(terminalShare * 100).toFixed(0)} % des Werts stammen aus dem Endwert, also aus der Annahme über die Zeit nach ${years} Jahren. Die Prognosephase trägt kaum zum Ergebnis bei.`
    );
  }
  if (equityValue <= 0) {
    caveats.push(
      "Nach Abzug der Nettoverschuldung bleibt kein positiver Eigenkapitalwert. Das Modell taugt hier nicht zur Bewertung."
    );
  }
  if (growthRate > 0.15) {
    caveats.push(
      `Ein Wachstum von ${(growthRate * 100).toFixed(0)} % über ${years} Jahre ist eine starke Annahme. Wenige Unternehmen halten das durch.`
    );
  }

  return {
    ok: true,
    fairValuePerShare: equityValue / sharesOutstanding,
    equityValue,
    enterpriseValue,
    presentValueOfForecast,
    presentValueOfTerminal,
    terminalShare,
    assumptions,
    caveats
  };
}

export type SensitivityCell = {
  discountRate: number;
  terminalGrowth: number;
  /** `null`, wenn diese Kombination keine gültige Bewertung ergibt. */
  fairValuePerShare: number | null;
};

export type SensitivityAnalysis = {
  cells: SensitivityCell[];
  /** Die Spanne über alle gültigen Kombinationen — **das** ist das Ergebnis. */
  range: { low: number; high: number } | null;
  /** Wie viele Kombinationen überhaupt rechenbar waren. */
  valid: number;
  total: number;
  note: string;
};

/**
 * Sensitivitätsanalyse über Diskontsatz und ewiges Wachstum.
 *
 * §37 verlangt sie, und §38 erklärt warum: die Spanne ist die ehrliche Antwort.
 * Ein einzelner DCF-Wert suggeriert eine Genauigkeit, die keine der Eingaben
 * hat — zwei Prozentpunkte mehr oder weniger beim Diskontsatz verschieben das
 * Ergebnis oft um die Hälfte.
 */
export function sensitivityAnalysis(
  base: DcfAssumptions,
  discountSteps: readonly number[] = [-0.02, -0.01, 0, 0.01, 0.02],
  growthSteps: readonly number[] = [-0.01, -0.005, 0, 0.005, 0.01]
): SensitivityAnalysis {
  const cells: SensitivityCell[] = [];

  for (const discountDelta of discountSteps) {
    for (const growthDelta of growthSteps) {
      const discountRate = Number((base.discountRate + discountDelta).toFixed(6));
      const terminalGrowth = Number((base.terminalGrowth + growthDelta).toFixed(6));
      const result = discountedCashFlow({ ...base, discountRate, terminalGrowth });

      cells.push({
        discountRate,
        terminalGrowth,
        fairValuePerShare: result.ok && result.fairValuePerShare > 0 ? result.fairValuePerShare : null
      });
    }
  }

  const values = cells
    .map((cell) => cell.fairValuePerShare)
    .filter((value): value is number => value !== null);

  return {
    cells,
    range: values.length ? { low: Math.min(...values), high: Math.max(...values) } : null,
    valid: values.length,
    total: cells.length,
    note: values.length
      ? `Spanne über ${values.length} von ${cells.length} Kombinationen. Die Breite ist keine Schwäche der Rechnung, sondern die tatsächliche Unsicherheit der Annahmen.`
      : "Keine der geprüften Kombinationen ergibt eine gültige Bewertung."
  };
}

/**
 * Formuliert das Ergebnis als Spanne.
 *
 * Genau die Darstellung, die §38 verlangt: „Base Case 145–170 €" statt „Ziel
 * 163,27 €". Gerundet wird bewusst grob — eine Spanne auf zwei
 * Nachkommastellen wäre wieder Scheingenauigkeit.
 */
export function formatValuationRange(range: { low: number; high: number } | null, currency = "€"): string {
  if (!range) return "Keine belastbare Bewertung möglich.";

  const round = (value: number) => (value >= 100 ? Math.round(value / 5) * 5 : Math.round(value));
  const low = round(range.low);
  const high = round(range.high);

  return low === high ? `etwa ${low} ${currency}` : `${low}–${high} ${currency}`;
}

/**
 * Reverse DCF: welches Wachstum rechtfertigt den heutigen Kurs?
 *
 * Die ehrlichere Frage als „was ist die Aktie wert". Statt eigene
 * Wachstumsannahmen zu setzen und daraus einen Wert abzuleiten, wird die
 * Annahme sichtbar gemacht, die im Kurs bereits steckt. Der Nutzer beurteilt
 * dann, ob sie plausibel ist — das ist eine Frage über das Unternehmen, keine
 * über das Modell.
 *
 * Gelöst durch Intervallhalbierung, weil der Wert monoton mit dem Wachstum
 * steigt.
 */
export function impliedGrowthRate(
  base: Omit<DcfAssumptions, "growthRate">,
  currentPrice: number,
  bounds = { min: -0.2, max: 0.6 }
): { growthRate: number; note: string } | null {
  if (!isPositive(currentPrice)) return null;

  const valueAt = (growthRate: number) => {
    const result = discountedCashFlow({ ...base, growthRate });
    return result.ok ? result.fairValuePerShare : null;
  };

  const lowValue = valueAt(bounds.min);
  const highValue = valueAt(bounds.max);
  if (lowValue === null || highValue === null) return null;

  if (currentPrice < lowValue) {
    return {
      growthRate: bounds.min,
      note: `Der Kurs liegt unter dem Wert, der sich selbst bei ${(bounds.min * 100).toFixed(0)} % Wachstum ergibt. Die Rechnung stößt an ihre Grenze.`
    };
  }
  if (currentPrice > highValue) {
    return {
      growthRate: bounds.max,
      note: `Der Kurs setzt mehr als ${(bounds.max * 100).toFixed(0)} % jährliches Wachstum voraus — mehr, als dieses Modell sinnvoll abbildet.`
    };
  }

  let low = bounds.min;
  let high = bounds.max;

  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    const value = valueAt(middle);
    if (value === null) break;
    if (value < currentPrice) low = middle;
    else high = middle;
  }

  const growthRate = (low + high) / 2;

  return {
    growthRate,
    note: `Der heutige Kurs setzt rund ${(growthRate * 100).toFixed(1)} % jährliches Wachstum des freien Cashflows über ${base.years} Jahre voraus. Ob das plausibel ist, ist eine Frage über das Unternehmen — nicht über das Modell.`
  };
}

export type YieldValuation = {
  /** Gewinnrendite: Kehrwert des KGV. Direkt mit Anleiherenditen vergleichbar. */
  earningsYield: number | null;
  /** Freie-Cashflow-Rendite bezogen auf den Unternehmenswert. */
  freeCashFlowYield: number | null;
  /** Abstand der Gewinnrendite zur risikofreien Verzinsung, in Prozentpunkten. */
  spreadToRiskFree: number | null;
  interpretation: string;
};

/**
 * Renditebasierte Betrachtung.
 *
 * Der Vorteil gegenüber dem KGV: eine Gewinnrendite lässt sich unmittelbar mit
 * der Verzinsung einer Staatsanleihe vergleichen. Ein KGV von 25 sagt wenig;
 * 4 % Gewinnrendite gegen 4,7 % risikofrei sagt viel.
 */
export function yieldValuation(input: {
  earningsYield?: number | null;
  freeCashFlowYield?: number | null;
  riskFreeRate?: number | null;
}): YieldValuation {
  const earningsYield = Number.isFinite(input.earningsYield ?? NaN) ? (input.earningsYield as number) : null;
  const freeCashFlowYield = Number.isFinite(input.freeCashFlowYield ?? NaN)
    ? (input.freeCashFlowYield as number)
    : null;
  const riskFreeRate = Number.isFinite(input.riskFreeRate ?? NaN) ? (input.riskFreeRate as number) : null;

  const spreadToRiskFree =
    earningsYield !== null && riskFreeRate !== null
      ? Number(((earningsYield - riskFreeRate) * 100).toFixed(2))
      : null;

  const interpretation =
    earningsYield === null
      ? "Keine Gewinnrendite verfügbar."
      : spreadToRiskFree === null
        ? `Gewinnrendite ${(earningsYield * 100).toFixed(1)} %. Ohne risikofreien Vergleichszins bleibt offen, ob das viel oder wenig ist.`
        : spreadToRiskFree > 0
          ? `Gewinnrendite ${(earningsYield * 100).toFixed(1)} %, also ${spreadToRiskFree} Prozentpunkte über der risikofreien Verzinsung. Der Aufschlag ist die Entschädigung für das unternehmerische Risiko.`
          : `Gewinnrendite ${(earningsYield * 100).toFixed(1)} % liegt ${Math.abs(spreadToRiskFree)} Prozentpunkte **unter** der risikofreien Verzinsung. Der Markt preist Wachstum ein, das in der aktuellen Gewinnzahl noch nicht steht.`;

  return { earningsYield, freeCashFlowYield, spreadToRiskFree, interpretation };
}

export type PeerMultiple = { symbol: string; name: string; value: number | null };

export type PeerComparison = {
  metric: string;
  own: number | null;
  peers: PeerMultiple[];
  /** Median der Vergleichsgruppe. Robuster gegen Ausreißer als der Mittelwert. */
  median: number | null;
  /** Wie das eigene Unternehmen zum Median steht, in Prozent. */
  premiumPercent: number | null;
  interpretation: string;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Vergleich mit der Wettbewerbsgruppe.
 *
 * Der **Median** statt des Mittelwerts: ein einzelnes Unternehmen mit einem
 * KGV von 300 würde den Durchschnitt der ganzen Gruppe unbrauchbar machen.
 *
 * Unter drei vergleichbaren Werten wird keine Aussage gebildet. Ein „Median"
 * aus zwei Zahlen ist deren Mittelwert und hat mit einer Vergleichsgruppe
 * nichts zu tun.
 */
export function comparePeers(metric: string, own: number | null, peers: readonly PeerMultiple[]): PeerComparison {
  const usable = peers
    .map((peer) => peer.value)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);

  const peerMedian = usable.length >= 3 ? median(usable) : null;

  const premiumPercent =
    own !== null && peerMedian !== null && peerMedian !== 0
      ? Number((((own - peerMedian) / peerMedian) * 100).toFixed(1))
      : null;

  const interpretation =
    peerMedian === null
      ? `Weniger als drei vergleichbare Werte für ${metric}. Ein Median daraus wäre keine Vergleichsgruppe.`
      : own === null
        ? `Für das Unternehmen selbst liegt ${metric} nicht vor. Der Median der Gruppe beträgt ${peerMedian.toFixed(1)}.`
        : premiumPercent === null
          ? `Vergleich nicht bildbar.`
          : Math.abs(premiumPercent) < 10
            ? `${metric} liegt mit ${own.toFixed(1)} nahe am Median der Gruppe (${peerMedian.toFixed(1)}).`
            : premiumPercent > 0
              ? `${metric} liegt ${premiumPercent} % über dem Median der Gruppe. Ein Aufschlag kann berechtigt sein — er muss durch Wachstum, Marge oder Qualität gedeckt sein.`
              : `${metric} liegt ${Math.abs(premiumPercent)} % unter dem Median der Gruppe. Ein Abschlag ist kein Kaufgrund, solange sein Anlass nicht geklärt ist.`;

  return { metric, own, peers: [...peers], median: peerMedian, premiumPercent, interpretation };
}

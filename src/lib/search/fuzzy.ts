/**
 * Unscharfe Suche über Instrumente.
 *
 * §48 verlangt eine globale Suche nach Ticker, Firmenname, ISIN, ETF, Index und
 * Kryptowährung — mit Fuzzy Search. Vorher gab es weder das eine noch das
 * andere: die Suche verglich Zeichenketten wörtlich, und „Microsft" fand nichts.
 *
 * **Die Regel, die den Entwurf bestimmt:** ein falscher Treffer ist schlimmer
 * als kein Treffer. Wer „APPL" tippt, meint fast sicher Apple — wer „XYZ"
 * tippt, meint nichts, und dann darf nicht das Ähnlichste ausgegeben werden.
 * Deshalb gibt es eine Mindestähnlichkeit, unterhalb derer nichts
 * zurückkommt.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

export type SearchMatchKind = "exact" | "prefix" | "substring" | "fuzzy" | "isin";

export type SearchCandidate = {
  symbol: string;
  name: string;
  /** Weitere Kennungen, etwa die ISIN. */
  isin?: string | null;
  assetClass?: string;
};

export type SearchHit<T extends SearchCandidate = SearchCandidate> = {
  item: T;
  /** 0 bis 100. */
  score: number;
  kind: SearchMatchKind;
  /** Warum dieser Treffer erschien — für die Anzeige und zum Nachprüfen. */
  reason: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Diakritika entfernen: "Nestlé" soll auf "nestle" passen.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Editierabstand nach Damerau-Levenshtein.
 *
 * Gegenüber dem einfachen Levenshtein zählt zusätzlich der **Zahlendreher** als
 * ein Schritt. Das ist beim Tippen der häufigste Fehler überhaupt: „Mircosoft"
 * statt „Microsoft" ist eine Vertauschung, nicht zwei getrennte Fehler.
 */
export function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => (row === 0 ? column : column === 0 ? row : 0))
  );

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + cost);
      }
    }
  }

  return matrix[rows - 1][columns - 1];
}

/** Ähnlichkeit von 0 bis 1 aus dem Editierabstand. */
export function similarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - editDistance(left, right) / longest;
}

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/**
 * Prüft eine ISIN samt Prüfziffer.
 *
 * Die Prüfziffer ist der eigentliche Gewinn: eine ISIN mit falscher Prüfziffer
 * ist ein **Tippfehler**, kein unbekanntes Wertpapier. Der Unterschied
 * entscheidet über die Fehlermeldung — „bitte Eingabe prüfen" statt „nicht
 * gefunden", was den Nutzer sonst an der falschen Stelle suchen ließe.
 *
 * Verfahren: Buchstaben werden zu Zahlen (A=10 … Z=35), danach Luhn.
 */
export function isValidIsin(value: string): boolean {
  const candidate = value.trim().toUpperCase();
  if (!ISIN_PATTERN.test(candidate)) return false;

  const digits = [...candidate]
    .map((character) =>
      /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character
    )
    .join("");

  let sum = 0;
  let double = true;

  // Von rechts nach links, jede zweite Ziffer verdoppelt.
  for (let index = digits.length - 2; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[digits.length - 1]);
}

/** Ob die Eingabe wie eine ISIN **aussieht**, unabhängig von der Prüfziffer. */
export function looksLikeIsin(value: string): boolean {
  return ISIN_PATTERN.test(value.trim().toUpperCase());
}

/**
 * Ab welcher Ähnlichkeit ein unscharfer Treffer gezeigt wird.
 *
 * 0,7 heißt bei einem Wort von zehn Zeichen: höchstens drei Fehler. Darunter
 * wird nichts ausgegeben — ein falscher Treffer ist schlimmer als kein
 * Treffer, weil er den Nutzer glauben lässt, er habe gefunden, was er suchte.
 */
const FUZZY_THRESHOLD = 0.7;

/** Kurze Eingaben werden nicht unscharf gesucht. */
const MIN_FUZZY_LENGTH = 4;

function scoreCandidate(query: string, candidate: SearchCandidate): SearchHit | null {
  const rawQuery = query.trim();
  const upperQuery = rawQuery.toUpperCase();

  // 1. ISIN -- exakt oder gar nicht. Eine unscharfe ISIN-Suche waere sinnlos:
  // eine um ein Zeichen abweichende ISIN ist ein anderes Papier.
  if (candidate.isin && looksLikeIsin(rawQuery) && candidate.isin.toUpperCase() === upperQuery) {
    return { item: candidate, score: 100, kind: "isin", reason: `ISIN ${candidate.isin}` };
  }

  const symbol = candidate.symbol.toUpperCase();
  const normalizedQuery = normalize(rawQuery);
  const normalizedName = normalize(candidate.name);

  if (symbol === upperQuery) {
    return { item: candidate, score: 100, kind: "exact", reason: `Ticker ${candidate.symbol}` };
  }
  if (normalizedName === normalizedQuery) {
    return { item: candidate, score: 98, kind: "exact", reason: `Name ${candidate.name}` };
  }
  if (symbol.startsWith(upperQuery)) {
    return { item: candidate, score: 90, kind: "prefix", reason: `Ticker beginnt mit „${rawQuery}“` };
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return { item: candidate, score: 86, kind: "prefix", reason: `Name beginnt mit „${rawQuery}“` };
  }

  // Wortanfang innerhalb des Namens: "motors" findet "General Motors".
  if (normalizedName.split(" ").some((word) => word.startsWith(normalizedQuery))) {
    return { item: candidate, score: 78, kind: "prefix", reason: `Wort im Namen beginnt mit „${rawQuery}“` };
  }
  if (normalizedName.includes(normalizedQuery)) {
    return { item: candidate, score: 68, kind: "substring", reason: `Name enthält „${rawQuery}“` };
  }

  if (normalizedQuery.length < MIN_FUZZY_LENGTH) return null;

  const bestName = Math.max(
    similarity(normalizedQuery, normalizedName),
    ...normalizedName.split(" ").map((word) => similarity(normalizedQuery, word))
  );
  const bestSymbol = similarity(normalizedQuery, symbol.toLowerCase());
  const best = Math.max(bestName, bestSymbol);

  if (best < FUZZY_THRESHOLD) return null;

  return {
    item: candidate,
    // Auf 40..64 abgebildet: ein unscharfer Treffer steht nie ueber einem
    // woertlichen.
    score: Math.round(40 + (best - FUZZY_THRESHOLD) * (24 / (1 - FUZZY_THRESHOLD))),
    kind: "fuzzy",
    reason: `Ähnlich geschrieben wie ${bestSymbol > bestName ? candidate.symbol : candidate.name}`
  };
}

export type SearchOutcome<T extends SearchCandidate = SearchCandidate> = {
  hits: SearchHit<T>[];
  /**
   * Warum nichts gefunden wurde — falls nichts gefunden wurde.
   *
   * Eine ISIN mit falscher Prüfziffer bekommt eine eigene Auskunft: sie ist ein
   * Tippfehler und kein fehlendes Wertpapier.
   */
  note: string | null;
};

export function searchInstruments<T extends SearchCandidate>(
  query: string,
  candidates: readonly T[],
  limit = 10
): SearchOutcome<T> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { hits: [], note: null };

  const hits = candidates
    .map((candidate) => scoreCandidate(trimmed, candidate) as SearchHit<T> | null)
    .filter((hit): hit is SearchHit<T> => hit !== null)
    .sort((left, right) => right.score - left.score || left.item.symbol.localeCompare(right.item.symbol))
    .slice(0, Math.max(1, limit));

  if (hits.length > 0) return { hits, note: null };

  if (looksLikeIsin(trimmed) && !isValidIsin(trimmed)) {
    return {
      hits: [],
      note: "Diese ISIN hat eine ungültige Prüfziffer. Vermutlich ein Tippfehler — bitte die Eingabe prüfen."
    };
  }
  if (isValidIsin(trimmed)) {
    return {
      hits: [],
      note: "Die ISIN ist gültig aufgebaut, das Papier ist hier aber nicht hinterlegt."
    };
  }

  return { hits: [], note: `Kein Instrument gefunden, das zu „${trimmed}“ passt.` };
}

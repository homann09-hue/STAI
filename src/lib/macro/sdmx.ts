/**
 * Parser für SDMX-CSV, wie die EZB es liefert.
 *
 * Bewusst ohne Bibliothek und ohne Netzzugriff: das Format ist schmal, und die
 * Fehlerfaelle sind der eigentliche Inhalt dieser Datei. Ein Parser, der bei
 * einer unerwarteten Antwort irgendetwas zurueckgibt, waere schlimmer als
 * keiner — er wuerde erfundene Makrowerte in die Analyse tragen.
 *
 * Grundregel: was nicht eindeutig als Zahl und Zeitpunkt lesbar ist, wird
 * verworfen, nicht geraten.
 */

export type MacroObservation = {
  /** Zeitpunkt wie geliefert: "2026-06-18" oder "2025-12". */
  period: string;
  value: number;
};

/**
 * Zerlegt eine CSV-Zeile unter Beachtung von Anfuehrungszeichen.
 *
 * Die EZB setzt Beschreibungstexte in Anfuehrungszeichen, und diese Texte
 * enthalten Kommas. Ein einfaches `split(",")` verschiebt dadurch alle
 * folgenden Spalten — der Wert einer Zeitreihe waere dann ein Textfragment.
 */
export function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      fields.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

/** Akzeptiert die Zeitformate, die in den gemessenen Reihen vorkommen. */
function isValidPeriod(value: string) {
  return /^\d{4}-\d{2}(-\d{2})?$/.test(value) || /^\d{4}-Q[1-4]$/.test(value) || /^\d{4}$/.test(value);
}

function parseNumber(value: string) {
  if (!value) return null;
  // Kein `parseFloat`: das wuerde "3,2 Prozent" klaglos zu 3 machen.
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type SdmxParseResult = {
  observations: MacroObservation[];
  /** Zeilen, die verworfen wurden. Sichtbar, statt still zu verschwinden. */
  rejectedRows: number;
};

/**
 * Liest Zeitpunkt und Wert aus einer SDMX-CSV-Antwort.
 *
 * Die Spalten werden über die Kopfzeile gefunden, nicht über eine Position.
 * Die EZB liefert je nach `detail`-Parameter unterschiedlich viele Spalten;
 * eine feste Position waere ein stiller Fehler bei der naechsten Aenderung.
 */
export function parseSdmxCsv(csv: string): SdmxParseResult {
  const rows = csv
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length < 2) return { observations: [], rejectedRows: 0 };

  const header = splitCsvRow(rows[0]).map((column) => column.toUpperCase());
  const periodIndex = header.indexOf("TIME_PERIOD");
  const valueIndex = header.indexOf("OBS_VALUE");

  // Ohne diese beiden Spalten ist die Antwort keine Zeitreihe. Das ist ein
  // Formatfehler und kein leeres Ergebnis.
  if (periodIndex === -1 || valueIndex === -1) {
    throw new Error("SDMX-Antwort enthält keine Zeitreihenspalten.");
  }

  const observations: MacroObservation[] = [];
  let rejectedRows = 0;

  for (const row of rows.slice(1)) {
    const fields = splitCsvRow(row);
    const period = fields[periodIndex] ?? "";
    const value = parseNumber(fields[valueIndex] ?? "");

    if (!isValidPeriod(period) || value === null) {
      rejectedRows += 1;
      continue;
    }

    observations.push({ period, value });
  }

  // Aufsteigend nach Zeit. Die EZB liefert bereits so, aber die Analyse
  // rechnet mit „letzter Eintrag ist der aktuellste" — darauf darf sie sich
  // nicht auf gut Glueck verlassen.
  observations.sort((left, right) => left.period.localeCompare(right.period));

  return { observations, rejectedRows };
}

/**
 * Wandelt einen SDMX-Zeitpunkt in ein Datum.
 *
 * Monatswerte werden auf das Monatsende gelegt, nicht auf den Ersten: der
 * HVPI für Dezember beschreibt den gesamten Dezember und ist am 1. Dezember
 * noch gar nicht bekannt. Ein Monatsanfang wuerde die Daten juenger aussehen
 * lassen, als sie sind.
 */
export function periodToDate(period: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const date = new Date(`${period}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    // Tag 0 des Folgemonats ist der letzte Tag des Monats.
    const date = new Date(Date.UTC(year, month, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const year = Number(period.slice(0, 4));
    const quarter = Number(period.slice(6));
    const date = new Date(Date.UTC(year, quarter * 3, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}$/.test(period)) {
    return new Date(Date.UTC(Number(period), 11, 31));
  }

  return null;
}

/**
 * SEC EDGAR — Filings aus der Primärquelle.
 *
 * §31 verlangt 10-K, 10-Q, 8-K, Form 4 und weitere Filings, und ausdrücklich:
 * „Originaldokumente verlinken." Genau das ist hier möglich, denn EDGAR **ist**
 * das Original — nicht die Auswertung eines Dritten, sondern das bei der
 * Behörde eingereichte Dokument.
 *
 * **Kostenlos und ohne Schlüssel.** Am 2026-08-08 gemessen: `data.sec.gov`
 * antwortet ohne Authentifizierung. Die SEC verlangt stattdessen einen
 * `User-Agent` mit Kontaktadresse; ohne ihn wird gesperrt. Das ist keine
 * Formalität, sondern Bedingung der Nutzung.
 *
 * Gemessen an Apple: 1000 jüngste Filings, darunter 587 Form 4, 105 8-K und
 * 34 10-Q.
 */

import { fetchBoundedProviderJson } from "@/lib/providers/http-json";

export const SEC_DATA_HOST = "data.sec.gov";
export const SEC_ARCHIVE_HOST = "www.sec.gov";

/**
 * Kennung gegenüber der SEC.
 *
 * Die SEC verlangt eine Kontaktadresse im User-Agent und sperrt anonyme
 * Zugriffe. Konfigurierbar, damit der Betreiber seine eigene Adresse hinterlegt
 * — eine fremde Adresse einzutragen wäre eine Falschangabe gegenüber einer
 * Behörde.
 */
export function secUserAgent() {
  const contact = process.env.SEC_CONTACT_EMAIL?.trim();
  return contact ? `StockPilotAI/0.1 ${contact}` : "StockPilotAI/0.1 contact-not-configured";
}

export function hasSecContact() {
  return Boolean(process.env.SEC_CONTACT_EMAIL?.trim());
}

/** Die Formulararten, die §31 namentlich nennt, mit Erklärung in einem Satz. */
export const trackedFilingForms: Record<string, string> = {
  "10-K": "Jahresbericht mit geprüftem Abschluss und Risikofaktoren",
  "10-Q": "Quartalsbericht, ungeprüft",
  "8-K": "Meldung eines wesentlichen Ereignisses zwischen den Berichten",
  "4": "Meldung einer Insidertransaktion binnen zwei Werktagen",
  "3": "Erstmeldung der Beteiligung eines Insiders",
  "5": "Jahresnachmeldung nicht meldepflichtiger Insidertransaktionen",
  "SC 13D": "Beteiligung über 5 % mit Absicht der Einflussnahme",
  "SC 13G": "Beteiligung über 5 % ohne Absicht der Einflussnahme",
  DEF14A: "Einladung zur Hauptversammlung, enthält Vorstandsvergütung",
  "S-1": "Registrierung einer Wertpapieremission"
};

export type SecFiling = {
  /** Aktenzeichen der Einreichung, eindeutig. */
  accessionNumber: string;
  form: string;
  /** Was die Formularart bedeutet — leer, wenn unbekannt. */
  formExplanation: string | null;
  /** Tag der Einreichung. */
  filedAt: string;
  /** Stichtag des Berichts. Nicht jede Einreichung hat einen. */
  reportDate: string | null;
  /** Direktlink auf das Originaldokument bei der SEC. §31 verlangt genau das. */
  documentUrl: string;
  /** Link auf das Einreichungsverzeichnis mit allen Anlagen. */
  indexUrl: string;
  description: string | null;
};

export type CompanyFilings = {
  cik: string;
  companyName: string;
  filings: SecFiling[];
  note: string;
};

function padCik(cik: number | string) {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

/**
 * Baut die Links auf das Original.
 *
 * Der Archivpfad benutzt die CIK **ohne** führende Nullen und die
 * Aktenzeichennummer **ohne** Bindestriche — zwei Eigenheiten, die sich nicht
 * ableiten lassen und deshalb hier festgehalten sind, gemessen am
 * funktionierenden Abruf eines Apple-Form-4.
 */
export function filingUrls(cik: string, accessionNumber: string, primaryDocument: string) {
  const bareCik = String(Number(cik));
  const bareAccession = accessionNumber.replace(/-/g, "");
  const base = `https://${SEC_ARCHIVE_HOST}/Archives/edgar/data/${bareCik}/${bareAccession}`;

  return {
    documentUrl: primaryDocument ? `${base}/${primaryDocument}` : `${base}/`,
    indexUrl: `${base}/${accessionNumber}-index.htm`
  };
}

type TickerEntry = { cik_str: number; ticker: string; title: string };

let tickerMapCache: Map<string, { cik: string; title: string }> | null = null;

export function clearSecCaches() {
  tickerMapCache = null;
}

/**
 * Übersetzt ein Börsenkürzel in die CIK der SEC.
 *
 * Die Zuordnungsdatei umfasst rund 10.400 Einträge und ändert sich selten;
 * sie wird deshalb einmal je Prozess geladen. **Nur US-Emittenten sind
 * enthalten** — für ein europäisches Papier gibt es schlicht keine CIK, und
 * das ist kein Fehler, sondern der Geltungsbereich der Behörde.
 */
export async function resolveCik(symbol: string): Promise<{ cik: string; title: string } | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;

  if (!tickerMapCache) {
    const url = new URL(`https://${SEC_ARCHIVE_HOST}/files/company_tickers.json`);
    const { data } = await fetchBoundedProviderJson<Record<string, TickerEntry>>(url, "SEC EDGAR", {
      timeoutMs: 12000,
      userAgent: secUserAgent(),
      maxBytes: 3_000_000
    });

    const map = new Map<string, { cik: string; title: string }>();
    for (const entry of Object.values(data ?? {})) {
      if (!entry?.ticker) continue;
      map.set(entry.ticker.toUpperCase(), { cik: padCik(entry.cik_str), title: entry.title });
    }
    tickerMapCache = map;
  }

  return tickerMapCache.get(normalized) ?? null;
}

type SubmissionsResponse = {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      form?: string[];
      filingDate?: string[];
      reportDate?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
};

/**
 * Holt die jüngsten Einreichungen.
 *
 * Wirft nicht. Ein nicht erreichbares Register darf keinen Analysepfad
 * abbrechen — es darf aber auch nicht durch erfundene Einträge ersetzt werden.
 */
export async function fetchCompanyFilings(
  symbol: string,
  options: { forms?: string[]; limit?: number } = {}
): Promise<CompanyFilings | null> {
  const limit = Math.max(1, Math.min(200, options.limit ?? 40));

  try {
    const resolved = await resolveCik(symbol);
    if (!resolved) return null;

    const url = new URL(`https://${SEC_DATA_HOST}/submissions/CIK${resolved.cik}.json`);
    const { data } = await fetchBoundedProviderJson<SubmissionsResponse>(url, "SEC EDGAR", {
      timeoutMs: 12000,
      userAgent: secUserAgent(),
      maxBytes: 12_000_000
    });

    return {
      cik: resolved.cik,
      companyName: data.name ?? resolved.title,
      filings: parseRecentFilings(resolved.cik, data, options.forms).slice(0, limit),
      note: hasSecContact()
        ? "Originaldokumente der U.S. Securities and Exchange Commission (EDGAR)."
        : "Originaldokumente der SEC (EDGAR). Hinweis: SEC_CONTACT_EMAIL ist nicht gesetzt — die SEC verlangt eine Kontaktadresse und kann Zugriffe sonst sperren."
    };
  } catch {
    return null;
  }
}

/**
 * Wertet die Einreichungsliste aus.
 *
 * Rein und ohne Netz, damit die Auswertung ohne Zugriff prüfbar bleibt. Die
 * SEC liefert **parallele Felder statt Objekte**: `form[i]` gehört zu
 * `filingDate[i]`. Ein Versatz zwischen den Feldern würde jedes Filing dem
 * falschen Datum zuordnen, ohne dass es auffiele — deshalb wird jede Zeile
 * nur übernommen, wenn alle Pflichtfelder an derselben Stelle vorliegen.
 */
export function parseRecentFilings(
  cik: string,
  data: SubmissionsResponse,
  forms?: string[]
): SecFiling[] {
  const recent = data.filings?.recent;
  if (!recent?.accessionNumber || !recent.form || !recent.filingDate) return [];

  const wanted = forms?.length ? new Set(forms.map((form) => form.toUpperCase())) : null;
  const count = Math.min(recent.accessionNumber.length, recent.form.length, recent.filingDate.length);
  const filings: SecFiling[] = [];

  for (let index = 0; index < count; index += 1) {
    const accessionNumber = recent.accessionNumber[index];
    const form = recent.form[index];
    const filedAt = recent.filingDate[index];
    if (!accessionNumber || !form || !filedAt) continue;
    if (wanted && !wanted.has(form.toUpperCase())) continue;

    const primaryDocument = recent.primaryDocument?.[index] ?? "";
    const { documentUrl, indexUrl } = filingUrls(cik, accessionNumber, primaryDocument);
    const reportDate = recent.reportDate?.[index];

    filings.push({
      accessionNumber,
      form,
      formExplanation: trackedFilingForms[form.toUpperCase()] ?? null,
      filedAt,
      reportDate: reportDate && reportDate.trim() ? reportDate : null,
      documentUrl,
      indexUrl,
      description: recent.primaryDocDescription?.[index]?.trim() || null
    });
  }

  return filings;
}

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

import { fetchBoundedProviderJson, fetchBoundedProviderText } from "@/lib/providers/http-json";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";

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
  const configured = process.env.SEC_EDGAR_USER_AGENT?.trim();
  if (configured && /@/.test(configured)) return configured;
  const contact = process.env.SEC_CONTACT_EMAIL?.trim();
  return contact ? `StockPilotAI/0.1 ${contact}` : "StockPilotAI/0.1 contact-not-configured";
}

export function hasSecContact() {
  return /@/.test(process.env.SEC_EDGAR_USER_AGENT?.trim() ?? "") || Boolean(process.env.SEC_CONTACT_EMAIL?.trim());
}

function secRouteAvailable() {
  return resolveProviderRoute({
    capability: "filings",
    assetClass: "equity",
    preferredProvider: "sec_edgar",
  }).providers.includes("sec_edgar");
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
  "13F-HR": "Quartalsweise Meldung institutioneller Wertpapierbestände",
  DEF14A: "Einladung zur Hauptversammlung, enthält Vorstandsvergütung",
  "S-1": "Registrierung einer Wertpapieremission",
  "20-F": "Jahresbericht eines ausländischen Emittenten",
  "6-K": "Laufende Meldung eines ausländischen Emittenten"
};

export function normalizeFilingForm(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ").slice(0, 16);
}

export function isTrackedFilingForm(value: string): boolean {
  const normalized = normalizeFilingForm(value);
  const base = normalized.endsWith("/A") ? normalized.slice(0, -2) : normalized;
  return Boolean(trackedFilingForms[base]);
}

function filingExplanation(value: string): string | null {
  const normalized = normalizeFilingForm(value);
  const amended = normalized.endsWith("/A");
  const base = amended ? normalized.slice(0, -2) : normalized;
  const explanation = trackedFilingForms[base];
  return explanation ? `${explanation}${amended ? " (Berichtigung)" : ""}` : null;
}

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
  /** Annahmezeitpunkt bei EDGAR, sofern in den Metadaten vorhanden. */
  acceptedAt: string | null;
  /** Direktlink auf das Originaldokument bei der SEC. §31 verlangt genau das. */
  documentUrl: string;
  /** Link auf das Einreichungsverzeichnis mit allen Anlagen. */
  indexUrl: string;
  primaryDocument: string | null;
  description: string | null;
  act: string | null;
  fileNumber: string | null;
  filmNumber: string | null;
  items: string | null;
  size: number | null;
  isXbrl: boolean | null;
  isInlineXbrl: boolean | null;
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

export function normalizeCikIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (!/^(?:CIK)?\d{1,10}$/i.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits && Number(digits) > 0 ? digits.padStart(10, "0") : null;
}

let secFairAccessQueue: Promise<void> = Promise.resolve();
let nextSecRequestAt = 0;

function secMinimumIntervalMs(requested?: number): number {
  const configured = Number(process.env.SEC_MIN_REQUEST_INTERVAL_MS);
  const candidate = requested ?? (Number.isFinite(configured) ? configured : 125);
  // Die SEC nennt maximal zehn Anfragen pro Sekunde. StockPilot bleibt mit
  // mindestens 100 ms auch bei Fehlkonfiguration innerhalb dieser Grenze.
  return Math.max(100, Math.min(candidate, 5_000));
}

export function runWithSecFairAccess<T>(task: () => Promise<T>, minimumIntervalMs?: number): Promise<T> {
  const run = secFairAccessQueue.then(async () => {
    const waitMs = Math.max(0, nextSecRequestAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nextSecRequestAt = Date.now() + secMinimumIntervalMs(minimumIntervalMs);
    return task();
  });
  secFairAccessQueue = run.then(() => undefined, () => undefined);
  return run;
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

  const safeDocument = primaryDocument
    .split("/")
    .filter((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== "." && segment !== "..")
    .join("/");

  return {
    documentUrl: safeDocument ? `${base}/${safeDocument}` : `${base}/`,
    indexUrl: `${base}/${accessionNumber}-index.htm`
  };
}

type TickerEntry = { cik_str: number; ticker: string; title: string };

let tickerMapCache: Map<string, { cik: string; title: string }> | null = null;

export function clearSecCaches() {
  tickerMapCache = null;
  secFairAccessQueue = Promise.resolve();
  nextSecRequestAt = 0;
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
  if (!secRouteAvailable()) return null;
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;
  const directCik = normalizeCikIdentifier(normalized);
  if (directCik) return { cik: directCik, title: `CIK ${directCik}` };

  if (!tickerMapCache) {
    const url = new URL(`https://${SEC_ARCHIVE_HOST}/files/company_tickers.json`);
    const { data } = await runWithSecFairAccess(() =>
      fetchBoundedProviderJson<Record<string, TickerEntry>>(url, "SEC EDGAR", {
        timeoutMs: 12000,
        userAgent: secUserAgent(),
        maxBytes: 3_000_000
      })
    );

    const map = new Map<string, { cik: string; title: string }>();
    for (const entry of Object.values(data ?? {})) {
      if (!entry?.ticker) continue;
      map.set(entry.ticker.toUpperCase(), { cik: padCik(entry.cik_str), title: entry.title });
    }
    tickerMapCache = map;
  }

  return tickerMapCache.get(normalized) ?? null;
}

type FilingRows = {
  accessionNumber?: string[];
  form?: string[];
  filingDate?: string[];
  reportDate?: string[];
  acceptanceDateTime?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: string[];
  act?: string[];
  fileNumber?: string[];
  filmNumber?: string[];
  items?: string[];
  size?: number[];
  isXBRL?: number[];
  isInlineXBRL?: number[];
};

type SubmissionsResponse = {
  name?: string;
  filings?: {
    recent?: FilingRows;
    files?: Array<{ name?: string; filingCount?: number; filingFrom?: string; filingTo?: string }>;
  };
};

function validSubmissionFileName(value: string | undefined): string | null {
  return value && /^CIK\d{10}-submissions-\d{3}\.json$/.test(value) ? value : null;
}

/**
 * Holt die jüngsten Einreichungen.
 *
 * Wirft nicht. Ein nicht erreichbares Register darf keinen Analysepfad
 * abbrechen — es darf aber auch nicht durch erfundene Einträge ersetzt werden.
 */
export async function fetchCompanyFilings(
  symbol: string,
  options: { forms?: string[]; limit?: number; maxArchiveFiles?: number } = {}
): Promise<CompanyFilings | null> {
  const limit = Math.max(1, Math.min(200, options.limit ?? 40));

  try {
    const resolved = await resolveCik(symbol);
    if (!resolved) return null;

    const url = new URL(`https://${SEC_DATA_HOST}/submissions/CIK${resolved.cik}.json`);
    const { data } = await runWithSecFairAccess(() =>
      fetchBoundedProviderJson<SubmissionsResponse>(url, "SEC EDGAR", {
        timeoutMs: 12000,
        userAgent: secUserAgent(),
        maxBytes: 12_000_000
      })
    );

    let filings = parseFilingRows(resolved.cik, data.filings?.recent, options.forms);
    const maxArchiveFiles = Math.max(0, Math.min(options.maxArchiveFiles ?? 4, 10));
    if (filings.length < limit && maxArchiveFiles > 0) {
      for (const entry of (data.filings?.files ?? []).slice(0, maxArchiveFiles)) {
        const fileName = validSubmissionFileName(entry.name);
        if (!fileName) continue;
        try {
          const archiveUrl = new URL(`https://${SEC_DATA_HOST}/submissions/${fileName}`);
          const archive = await runWithSecFairAccess(() =>
            fetchBoundedProviderJson<FilingRows>(archiveUrl, "SEC EDGAR", {
              timeoutMs: 12000,
              userAgent: secUserAgent(),
              maxBytes: 12_000_000
            })
          );
          filings = deduplicateFilings([...filings, ...parseFilingRows(resolved.cik, archive.data, options.forms)]);
          if (filings.length >= limit) break;
        } catch {
          // Ein unlesbares historisches Segment darf die aktuellen Filings
          // nicht entwerten. Es wird niemals durch Ersatzdaten aufgefuellt.
        }
      }
    }
    filings.sort((left, right) => (right.acceptedAt ?? right.filedAt).localeCompare(left.acceptedAt ?? left.filedAt));

    return {
      cik: resolved.cik,
      companyName: data.name ?? resolved.title,
      filings: filings.slice(0, limit),
      note: hasSecContact()
        ? "Originaldokumente der U.S. Securities and Exchange Commission (EDGAR)."
        : "Originaldokumente der SEC (EDGAR). Hinweis: SEC_CONTACT_EMAIL ist nicht gesetzt — die SEC verlangt eine Kontaktadresse und kann Zugriffe sonst sperren."
    };
  } catch {
    return null;
  }
}

/**
 * Holt die Form-4-Meldungen samt Inhalt.
 *
 * Zwei Dinge sind hier bewusst begrenzt:
 *
 * - **Wenige Meldungen.** Jede ist ein eigener Abruf; die SEC bittet
 *   ausdrücklich um Zurückhaltung. Acht decken bei den meisten Unternehmen
 *   mehrere Wochen ab.
 * - **Nacheinander statt gleichzeitig.** Acht parallele Anfragen gegen eine
 *   Behördenschnittstelle sind unhöflich und riskieren eine Sperre.
 *
 * Einzelne unlesbare Meldungen werden übersprungen, nicht ersetzt.
 */
/**
 * Macht aus dem Anzeigelink den Link auf das Rohdokument.
 *
 * Die SEC gibt als `primaryDocument` eines Form 4 den Pfad
 * `xslF345X06/form4.xml` an — das ist die **über ein Stylesheet gerenderte
 * HTML-Ansicht** und wird als `text/html` ausgeliefert. Das Rohdokument liegt
 * eine Ebene höher unter `form4.xml` und kommt als `text/xml`.
 *
 * Am 2026-08-08 an einer echten Apple-Meldung geprüft. Ohne diesen Schritt
 * bekäme der Parser HTML statt XML und fände nie eine Transaktion — ein
 * Fehler, der still zu „keine Insidergeschäfte" geführt hätte statt zu einer
 * Störung.
 */
export function rawFilingDocumentUrl(documentUrl: string): string {
  return documentUrl.replace(/\/xsl[^/]*\//i, "/");
}

export async function fetchInsiderTransactions(symbol: string, limit = 8) {
  const filings = await fetchCompanyFilings(symbol, { forms: ["4"], limit });
  if (!filings) return null;

  const { parseForm4 } = await import("@/lib/sec/form4");
  const transactions = [];

  for (const filing of filings.filings) {
    try {
      const { text } = await runWithSecFairAccess(() =>
        fetchBoundedProviderText(new URL(rawFilingDocumentUrl(filing.documentUrl)), "SEC EDGAR", {
          timeoutMs: 8000,
          userAgent: secUserAgent(),
          accept: "application/xml",
          expectedContentType: "xml",
          maxBytes: 400_000
        })
      );

      const parsed = parseForm4(text);
      if (parsed) transactions.push(...parsed.transactions);
    } catch {
      // Eine unlesbare Meldung ueberspringen. Sie zu ersetzen waere eine
      // Erfindung, das Abbrechen waere unverhaeltnismaessig.
    }
  }

  return { companyName: filings.companyName, cik: filings.cik, transactions };
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
  return parseFilingRows(cik, data.filings?.recent, forms);
}

export function parseFilingRows(cik: string, recent: FilingRows | undefined, forms?: string[]): SecFiling[] {
  if (!recent?.accessionNumber || !recent.form || !recent.filingDate) return [];

  const wanted = forms?.length ? new Set(forms.map(normalizeFilingForm)) : null;
  const count = Math.min(recent.accessionNumber.length, recent.form.length, recent.filingDate.length);
  const filings: SecFiling[] = [];

  for (let index = 0; index < count; index += 1) {
    const accessionNumber = recent.accessionNumber[index];
    const form = recent.form[index];
    const filedAt = recent.filingDate[index];
    if (!accessionNumber || !form || !filedAt) continue;
    const normalizedForm = normalizeFilingForm(form);
    const amendedBase = normalizedForm.endsWith("/A") ? normalizedForm.slice(0, -2) : null;
    if (wanted && !wanted.has(normalizedForm) && !(amendedBase && wanted.has(amendedBase))) continue;

    const primaryDocument = recent.primaryDocument?.[index] ?? "";
    const { documentUrl, indexUrl } = filingUrls(cik, accessionNumber, primaryDocument);
    const reportDate = recent.reportDate?.[index];

    filings.push({
      accessionNumber,
      form,
      formExplanation: filingExplanation(form),
      filedAt,
      reportDate: reportDate && reportDate.trim() ? reportDate : null,
      acceptedAt: recent.acceptanceDateTime?.[index]?.trim() || null,
      documentUrl,
      indexUrl,
      primaryDocument: primaryDocument || null,
      description: recent.primaryDocDescription?.[index]?.trim() || null,
      act: recent.act?.[index]?.trim() || null,
      fileNumber: recent.fileNumber?.[index]?.trim() || null,
      filmNumber: recent.filmNumber?.[index]?.trim() || null,
      items: recent.items?.[index]?.trim() || null,
      size: Number.isFinite(recent.size?.[index]) ? recent.size?.[index] ?? null : null,
      isXbrl: recent.isXBRL?.[index] === 1 ? true : recent.isXBRL?.[index] === 0 ? false : null,
      isInlineXbrl: recent.isInlineXBRL?.[index] === 1 ? true : recent.isInlineXBRL?.[index] === 0 ? false : null
    });
  }

  return deduplicateFilings(filings);
}

export function deduplicateFilings(filings: readonly SecFiling[]): SecFiling[] {
  const unique = new Map<string, SecFiling>();
  for (const filing of filings) {
    if (!unique.has(filing.accessionNumber)) unique.set(filing.accessionNumber, filing);
  }
  return [...unique.values()];
}

export function detectNewFilings(filings: readonly SecFiling[], knownAccessions: ReadonlySet<string>): SecFiling[] {
  return deduplicateFilings(filings).filter((filing) => !knownAccessions.has(filing.accessionNumber));
}

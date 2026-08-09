/**
 * Rechnungen aus Stripe, aufbereitet für die Anzeige.
 *
 * Reine Umformung ohne Ein-/Ausgabe. Zwei Eigenschaften sind hier wichtiger als
 * die Formatierung:
 *
 *  1. **Links werden geprüft, nicht durchgereicht.** `hosted_invoice_url` und
 *     `invoice_pdf` kommen zwar von Stripe, landen aber als anklickbarer Link
 *     im Browser des Nutzers. Was nicht nachweislich auf `stripe.com` zeigt,
 *     wird verworfen statt angezeigt.
 *  2. **Kein erfundener Status.** Ein unbekannter Stripe-Status wird als
 *     unbekannt ausgewiesen und nicht auf „bezahlt" gerundet.
 */

export type InvoiceStatus = "paid" | "open" | "draft" | "uncollectible" | "void" | "unknown";

export type BillingInvoice = {
  id: string;
  /** Die von Stripe vergebene Rechnungsnummer. Null bei Entwürfen. */
  number: string | null;
  status: InvoiceStatus;
  statusLabel: string;
  /** Beträge in der kleinsten Währungseinheit, wie Stripe sie liefert. */
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  /** Nur gesetzt, wenn die URL nachweislich zu Stripe gehört. */
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  paid: "Bezahlt",
  open: "Offen",
  draft: "Entwurf",
  uncollectible: "Nicht einbringlich",
  void: "Storniert",
  unknown: "Unbekannt"
};

const knownStatuses = new Set<InvoiceStatus>(["paid", "open", "draft", "uncollectible", "void"]);

/**
 * Prüft, ob eine URL sicher als Rechnungslink angezeigt werden darf.
 *
 * Auch Daten von einem vertrauenswürdigen Anbieter werden geprüft, bevor sie zu
 * einem Link im Browser des Nutzers werden. Eingebettete Zugangsdaten in der
 * URL sind ebenfalls ein Ausschlussgrund.
 */
export function isTrustedStripeDocumentUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com");
  } catch {
    return false;
  }
}

function normalizeStatus(value: unknown): InvoiceStatus {
  return typeof value === "string" && knownStatuses.has(value as InvoiceStatus)
    ? (value as InvoiceStatus)
    : "unknown";
}

function timestampToIso(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? new Date(value * 1_000).toISOString()
    : null;
}

function safeAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export type StripeInvoiceInput = {
  id?: unknown;
  number?: unknown;
  status?: unknown;
  amount_due?: unknown;
  amount_paid?: unknown;
  currency?: unknown;
  created?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  hosted_invoice_url?: unknown;
  invoice_pdf?: unknown;
};

/**
 * Formt eine Stripe-Rechnung um.
 *
 * Gibt `null` zurück, wenn Kennung oder Erstellungszeitpunkt fehlen — ohne
 * beides ist der Eintrag in einer Rechnungsliste wertlos und würde nur eine
 * leere Zeile erzeugen.
 */
export function normalizeInvoice(raw: StripeInvoiceInput | null | undefined): BillingInvoice | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.startsWith("in_")) return null;

  const createdAt = timestampToIso(raw.created);
  if (!createdAt) return null;

  const status = normalizeStatus(raw.status);

  return {
    id: raw.id,
    number: typeof raw.number === "string" && raw.number.trim() ? raw.number.trim().slice(0, 60) : null,
    status,
    statusLabel: invoiceStatusLabels[status],
    amountDue: safeAmount(raw.amount_due),
    amountPaid: safeAmount(raw.amount_paid),
    currency: typeof raw.currency === "string" ? raw.currency.toUpperCase().slice(0, 3) : "EUR",
    createdAt,
    periodStart: timestampToIso(raw.period_start),
    periodEnd: timestampToIso(raw.period_end),
    hostedInvoiceUrl: isTrustedStripeDocumentUrl(raw.hosted_invoice_url) ? raw.hosted_invoice_url : null,
    pdfUrl: isTrustedStripeDocumentUrl(raw.invoice_pdf) ? raw.invoice_pdf : null
  };
}

export function normalizeInvoices(rows: readonly (StripeInvoiceInput | null | undefined)[]) {
  return rows
    .map((row) => normalizeInvoice(row))
    .filter((invoice): invoice is BillingInvoice => invoice !== null);
}

/** Betrag aus der kleinsten Währungseinheit in eine lesbare Angabe. */
export function formatInvoiceAmount(amountMinor: number, currency: string) {
  return (amountMinor / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR"
  });
}

export type PaymentMethodSummary = {
  brand: string;
  last4: string;
  expiresAt: string | null;
};

/**
 * Fasst die hinterlegte Zahlungsmethode zusammen.
 *
 * Bewusst nur Marke, die letzten vier Ziffern und das Ablaufdatum. Mehr braucht
 * die Anzeige nicht, und mehr soll die Anwendung auch nicht anfassen.
 */
export function normalizePaymentMethod(raw: unknown): PaymentMethodSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const card = (raw as { card?: unknown }).card;
  if (!card || typeof card !== "object") return null;

  const details = card as { brand?: unknown; last4?: unknown; exp_month?: unknown; exp_year?: unknown };
  const last4 = typeof details.last4 === "string" && /^\d{4}$/.test(details.last4) ? details.last4 : null;
  if (!last4) return null;

  const brand = typeof details.brand === "string" ? details.brand.slice(0, 24) : "Karte";
  const month = typeof details.exp_month === "number" ? details.exp_month : null;
  const year = typeof details.exp_year === "number" ? details.exp_year : null;

  return {
    brand,
    last4,
    expiresAt:
      month !== null && year !== null && month >= 1 && month <= 12
        ? `${String(month).padStart(2, "0")}/${year}`
        : null
  };
}

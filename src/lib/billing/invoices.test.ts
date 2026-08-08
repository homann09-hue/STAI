import { describe, expect, it } from "vitest";
import {
  formatInvoiceAmount,
  isTrustedStripeDocumentUrl,
  normalizeInvoice,
  normalizeInvoices,
  normalizePaymentMethod
} from "@/lib/billing/invoices";

/**
 * Rechnungen sind der Teil des Produkts, in dem Geld und personenbezogene Daten
 * zusammenkommen. Die Tests prüfen deshalb zuerst, was nicht passieren darf.
 */

const validInvoice = {
  id: "in_1PabcdEFGH",
  number: "STAI-0001",
  status: "paid",
  amount_due: 2900,
  amount_paid: 2900,
  currency: "eur",
  created: 1_780_000_000,
  period_start: 1_780_000_000,
  period_end: 1_782_592_000,
  hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/test",
  invoice_pdf: "https://pay.stripe.com/invoice/acct_1/test/pdf"
};

describe("isTrustedStripeDocumentUrl", () => {
  it("akzeptiert Stripe-Adressen über HTTPS", () => {
    expect(isTrustedStripeDocumentUrl("https://invoice.stripe.com/i/acct_1/x")).toBe(true);
    expect(isTrustedStripeDocumentUrl("https://stripe.com/x")).toBe(true);
  });

  it("weist Adressen ab, die nur so aussehen wie Stripe", () => {
    // Der klassische Fehler ist eine Pruefung mit `includes("stripe.com")`.
    expect(isTrustedStripeDocumentUrl("https://stripe.com.angreifer.test/i/x")).toBe(false);
    expect(isTrustedStripeDocumentUrl("https://notstripe.com/i/x")).toBe(false);
  });

  it("weist unverschlüsselte Adressen und eingebettete Zugangsdaten ab", () => {
    expect(isTrustedStripeDocumentUrl("http://invoice.stripe.com/i/x")).toBe(false);
    expect(isTrustedStripeDocumentUrl("https://user:pass@invoice.stripe.com/i/x")).toBe(false);
  });

  it("weist alles ab, was gar keine Adresse ist", () => {
    expect(isTrustedStripeDocumentUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedStripeDocumentUrl(null)).toBe(false);
    expect(isTrustedStripeDocumentUrl(42)).toBe(false);
  });
});

describe("normalizeInvoice", () => {
  it("übernimmt eine vollständige Rechnung", () => {
    const invoice = normalizeInvoice(validInvoice);

    expect(invoice).not.toBeNull();
    expect(invoice?.number).toBe("STAI-0001");
    expect(invoice?.status).toBe("paid");
    expect(invoice?.statusLabel).toBe("Bezahlt");
    expect(invoice?.amountDue).toBe(2900);
    expect(invoice?.currency).toBe("EUR");
    expect(invoice?.hostedInvoiceUrl).toBe("https://invoice.stripe.com/i/acct_1/test");
  });

  it("verwirft einen manipulierten Rechnungslink, statt ihn anzuzeigen", () => {
    const invoice = normalizeInvoice({
      ...validInvoice,
      hosted_invoice_url: "https://angreifer.test/rechnung",
      invoice_pdf: "javascript:alert(1)"
    });

    // Die Rechnung bleibt sichtbar, nur der Link fehlt. Ein unterdruecktes
    // Dokument ist besser als ein Link an ein fremdes Ziel.
    expect(invoice).not.toBeNull();
    expect(invoice?.hostedInvoiceUrl).toBeNull();
    expect(invoice?.pdfUrl).toBeNull();
  });

  it("rundet einen unbekannten Status nicht auf „bezahlt“", () => {
    const invoice = normalizeInvoice({ ...validInvoice, status: "irgendwas_neues" });

    expect(invoice?.status).toBe("unknown");
    expect(invoice?.statusLabel).toBe("Unbekannt");
  });

  it("verwirft Einträge ohne Kennung oder Zeitpunkt", () => {
    expect(normalizeInvoice({ ...validInvoice, id: "cus_1" })).toBeNull();
    expect(normalizeInvoice({ ...validInvoice, created: 0 })).toBeNull();
    expect(normalizeInvoice(null)).toBeNull();
  });

  it("behandelt einen Entwurf ohne Nummer als Entwurf", () => {
    const invoice = normalizeInvoice({ ...validInvoice, number: null, status: "draft" });

    expect(invoice?.number).toBeNull();
    expect(invoice?.statusLabel).toBe("Entwurf");
  });

  it("filtert unbrauchbare Zeilen aus einer Liste heraus", () => {
    expect(normalizeInvoices([validInvoice, null, { id: "kaputt" }])).toHaveLength(1);
  });
});

describe("formatInvoiceAmount", () => {
  it("rechnet die kleinste Währungseinheit in einen lesbaren Betrag", () => {
    expect(formatInvoiceAmount(2900, "EUR")).toMatch(/29,00/);
  });

  it("fällt bei einer unsinnigen Währung nicht aus", () => {
    expect(() => formatInvoiceAmount(2900, "nicht-echt")).not.toThrow();
  });
});

describe("normalizePaymentMethod", () => {
  it("zeigt Marke, letzte vier Ziffern und Ablauf", () => {
    const method = normalizePaymentMethod({ card: { brand: "visa", last4: "4242", exp_month: 4, exp_year: 2029 } });

    expect(method).toEqual({ brand: "visa", last4: "4242", expiresAt: "04/2029" });
  });

  it("gibt ohne belastbare Kartendaten nichts zurück", () => {
    expect(normalizePaymentMethod({ card: { brand: "visa", last4: "42" } })).toBeNull();
    expect(normalizePaymentMethod("pm_123")).toBeNull();
    expect(normalizePaymentMethod(null)).toBeNull();
  });

  it("erfindet kein Ablaufdatum aus unvollständigen Angaben", () => {
    const method = normalizePaymentMethod({ card: { brand: "visa", last4: "4242", exp_month: 13, exp_year: 2029 } });
    expect(method?.expiresAt).toBeNull();
  });
});

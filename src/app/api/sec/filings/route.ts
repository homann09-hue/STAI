import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { fetchCompanyFilings, hasSecContact } from "@/lib/sec/edgar";
import { validateSymbol } from "@/lib/validation";

/**
 * §31: Filings mit Link auf das Originaldokument.
 *
 * Bewusst ohne Entitlement-Gate: EDGAR ist ein öffentliches Register, und der
 * Zugang dazu hinter eine Bezahlschranke zu stellen wäre schwer zu
 * rechtfertigen. Die Auswertung darüber (§32) kann später gegatet werden — der
 * Rohzugang nicht.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = validateSymbol(searchParams.get("symbol") ?? "");
  if (!parsed.success) return jsonError("Ungültiges Symbol.", 400);

  const requestedForms = (searchParams.get("forms") ?? "")
    .split(",")
    .map((form) => form.trim())
    .filter((form) => form.length > 0 && form.length <= 12)
    .slice(0, 10);

  const result = await fetchCompanyFilings(parsed.data, {
    forms: requestedForms.length ? requestedForms : undefined,
    limit: 40
  });

  if (!result) {
    // Kein Register-Eintrag ist keine Stoerung. Die SEC kennt nur
    // US-Emittenten -- fuer ein europaeisches Papier gibt es schlicht keine
    // CIK, und das gehoert als Auskunft gesagt statt als Fehler.
    return jsonOk(
      {
        symbol: parsed.data,
        filings: [],
        available: false,
        note: "Für dieses Symbol liegt kein Eintrag im SEC-Register vor. Die Behörde erfasst nur US-Emittenten."
      },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  }

  return jsonOk(
    {
      symbol: parsed.data,
      cik: result.cik,
      companyName: result.companyName,
      available: true,
      filings: result.filings,
      note: result.note,
      contactConfigured: hasSecContact(),
      disclaimer:
        "Originaldokumente der U.S. Securities and Exchange Commission. Die Verlinkung führt unverändert zum eingereichten Dokument; StockPilot nimmt keine inhaltliche Prüfung vor."
    },
    // Filings aendern sich taeglich, nicht sekuendlich. Eine Stunde haelt die
    // Last bei der Behoerde klein -- die SEC bittet ausdruecklich darum.
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } }
  );
}

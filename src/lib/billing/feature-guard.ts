import "server-only";
import { jsonError, secureJsonHeaders } from "@/lib/api-guard";
import { getUserEntitlements } from "@/lib/billing/server";
import {
  evaluateFeatureAccess,
  featureDenialStatus,
  planThatUnlocks,
  type FeatureAccessDecision,
  type FeaturePaywall
} from "@/lib/billing/feature-access";
import { getStripeBillingConfiguration } from "@/lib/billing/stripe";
import type { ResolvedEntitlements } from "@/lib/billing/entitlements";
import type { FeatureId } from "@/lib/feature-gates";
import {
  buildQuotaStatus,
  quotaFeatureNames,
  quotaHeaders,
  quotaLimitFor,
  secondsUntilReset,
  type QuotaKey,
  type QuotaStatus
} from "@/lib/billing/usage-quota";
import { logEvent } from "@/lib/observability";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

/**
 * Serverseitige Durchsetzung der Tarifberechtigungen.
 *
 * Vor dieser Datei war die Feature-Karte reine Anzeigeinformation: sie wurde
 * berechnet, an den Browser geschickt und dort ausgewertet. Wer die Route direkt
 * aufrief, bekam den kostenpflichtigen Inhalt. Ein Tarif, dessen Leistung ohne
 * Konto erreichbar ist, lässt sich nicht verkaufen.
 *
 * `requireFeature` ist deshalb der einzige zulässige Weg, eine kostenpflichtige
 * Route zu öffnen.
 */

export type AuthenticatedContext = Awaited<ReturnType<typeof getSupabaseAuth>> & { ok: true };

export type FeatureGuardResult =
  | { ok: true; auth: AuthenticatedContext; entitlements: ResolvedEntitlements }
  | { ok: false; response: Response };

/**
 * Ob für den freischaltenden Tarif ein Checkout konfiguriert ist.
 *
 * Ohne diese Prüfung würde die Paywall zu einem Upgrade auffordern, das gar
 * nicht durchführbar ist.
 */
function checkoutAvailableFor(featureId: FeatureId) {
  const requiredPlan = planThatUnlocks(featureId);
  if (!requiredPlan || requiredPlan === "free") return false;
  const plans = getStripeBillingConfiguration().plans;
  const intervals = plans[requiredPlan];
  // Buchbar heisst: mindestens ein Abrechnungszeitraum hat einen hinterlegten
  // Preis. Welcher, entscheidet der Nutzer spaeter im Checkout.
  return Boolean(intervals && (intervals.month || intervals.year));
}

/**
 * Antwortkopf für kostenpflichtige Inhalte.
 *
 * Gegatete Antworten dürfen unter keinen Umständen in einen geteilten Cache.
 * Die übrigen Datenrouten setzen `s-maxage`, damit das CDN die Providerkosten
 * dämpft — genau das würde hier aber die Prüfung aushebeln: nach einem
 * berechtigten Aufruf läge der Bezahlinhalt im CDN und ginge an jeden weiteren
 * Aufrufer. Die Kostenbremse bleibt trotzdem erhalten, sie sitzt serverseitig
 * in `withCacheFallback`.
 */
export const entitledCacheHeaders = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
} as const;

/** Antwort auf eine abgelehnte Anfrage: Grund, Tarif und nächster Schritt. */
export function paywallResponse(paywall: FeaturePaywall) {
  const status = featureDenialStatus(paywall.reason);
  const response = jsonError(paywall.message, status, {
    "X-StockPilot-Paywall": paywall.reason,
    "X-StockPilot-Required-Plan": paywall.requiredPlan ?? "none"
  });

  // `jsonError` liefert nur Text. Die strukturierte Paywall gehört daneben,
  // damit der Client nicht die Fehlermeldung parsen muss, um zu wissen, welche
  // Funktion fehlt und welcher Tarif sie enthält.
  return new Response(
    JSON.stringify({
      error: paywall.message,
      paywall
    }),
    { status, headers: response.headers }
  );
}

/**
 * Prüft Anmeldung und Tarif für eine kostenpflichtige Funktion.
 *
 * Fail closed: Ist der Billingstatus nicht lesbar, wird nicht freigegeben.
 * Ist Supabase nicht konfiguriert, wird ebenfalls nicht freigegeben — sonst
 * wäre ein unvollständig konfiguriertes Deployment ein Gratistarif.
 */
export async function requireFeature(request: Request, featureId: FeatureId): Promise<FeatureGuardResult> {
  const checkoutAvailable = checkoutAvailableFor(featureId);
  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    // `missing_client` bedeutet: Supabase ist nicht vollständig konfiguriert.
    // Das ist ein Betriebsfehler, kein Nutzerfehler — und ohne diese
    // Unterscheidung würde ein unfertiges Deployment jede Bezahlfunktion
    // verschenken.
    const configurationFault = auth.reason === "missing_client";
    if (configurationFault) {
      logEvent("error", "billing.feature_guard_unverifiable", { featureId, reason: auth.reason });
    }

    const decision = evaluateFeatureAccess(featureId, {
      entitlements: null,
      authenticated: false,
      billingReadable: !configurationFault,
      checkoutAvailable
    }) as Extract<FeatureAccessDecision, { allowed: false }>;

    return { ok: false, response: paywallResponse(decision.paywall) };
  }

  const entitlements = await getUserEntitlements(auth);
  const decision = evaluateFeatureAccess(featureId, {
    entitlements,
    authenticated: true,
    checkoutAvailable
  });

  if (!decision.allowed) {
    logEvent("info", "billing.feature_denied", {
      userId: auth.userId,
      featureId,
      reason: decision.reason,
      plan: entitlements.plan
    });
    return { ok: false, response: paywallResponse(decision.paywall) };
  }

  return { ok: true, auth, entitlements };
}

/**
 * Zaehlt eine Nutzung gegen die Tagesquote des Tarifs.
 *
 * Gezaehlt wird in der Datenbank, in einer einzigen atomaren Anweisung. Waeren
 * Lesen und Erhoehen zwei Schritte, koennten zwei gleichzeitige Anfragen beide
 * die letzte freie Einheit sehen und beide zugreifen.
 *
 * Der tokengebundene Client ist hier die Sicherheitsgrenze: die RPC leitet
 * den Besitzer ausschliesslich aus `auth.uid()` ab. Ein Aufrufer kann deshalb
 * weder eine fremde `user_id` uebergeben noch die Tabelle direkt beschreiben.
 */
export async function consumeQuota(
  auth: AuthenticatedContext,
  entitlements: ResolvedEntitlements,
  quota: QuotaKey
): Promise<{ ok: true; status: QuotaStatus } | { ok: false; response: Response }> {
  const limit = quotaLimitFor(entitlements.plan, quota);
  const now = new Date();

  const { data, error } = await auth.supabase.rpc("consume_feature_quota", {
    p_feature: quotaFeatureNames[quota],
    p_limit: limit
  });

  if (error) {
    // Fail closed: ohne belastbaren Zaehler wird nicht freigegeben. Sonst waere
    // eine Stoerung der Quotentabelle ein unbegrenztes Kontingent.
    logEvent("error", "billing.quota_check_failed", {
      userId: auth.userId,
      quota,
      code: error.code,
      message: error.message
    });
    return {
      ok: false,
      response: jsonError("Dein Kontingent lässt sich gerade nicht prüfen. Es wurde nichts verbraucht.", 503, {
        ...entitledCacheHeaders
      })
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const used = Number(row?.used ?? 0);
  const reportedLimit = Number(row?.quota_limit ?? limit);
  const status = buildQuotaStatus(quota, entitlements.plan, used, reportedLimit, now);

  if (row?.allowed !== true) {
    logEvent("info", "billing.quota_exceeded", {
      userId: auth.userId,
      quota,
      plan: entitlements.plan,
      used,
      limit: reportedLimit
    });

    return {
      ok: false,
      response: new Response(JSON.stringify({ error: status.message, quota: status }), {
        status: 429,
        headers: new Headers({
          ...secureJsonHeaders,
          ...entitledCacheHeaders,
          ...quotaHeaders(status),
          "Retry-After": `${secondsUntilReset(now)}`,
          "Content-Type": "application/json"
        })
      })
    };
  }

  return { ok: true, status };
}

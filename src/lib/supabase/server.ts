import "server-only";
import { createClient } from "@supabase/supabase-js";

function isSafeSupabaseUrl(url: string | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isLikelyServiceKey(value: string | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("sb_publishable_")) return false;
  if (value.startsWith("sb_secret_")) return true;
  return value.split(".").length === 3 || value.length >= 40;
}

/**
 * Service-Role-Client. Umgeht Row Level Security vollständig.
 *
 * Nur für Pfade verwenden, die echte Privilegien brauchen: Admin-API,
 * Webhooks und serverinterne Tabellen, die normalen Nutzern verwehrt sind.
 * Für Nutzerdaten stattdessen `createSupabaseUserClient()` verwenden, damit RLS
 * die Mandantentrennung erzwingt und nicht der Anwendungscode.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isSafeSupabaseUrl(url) || !isLikelyServiceKey(serviceKey)) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function publishableSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Nutzergebundener Client. Führt jede Abfrage unter der Rolle `authenticated`
 * mit der Identität des Access Tokens aus, sodass RLS greift.
 *
 * Ein vergessener `.eq("user_id", ...)`-Filter führt damit nicht mehr zu einem
 * Cross-Tenant-Leak, sondern zu einem leeren Ergebnis.
 */
export function createSupabaseUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = publishableSupabaseKey();

  if (!isSafeSupabaseUrl(url) || !publishableKey || !accessToken) return null;

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

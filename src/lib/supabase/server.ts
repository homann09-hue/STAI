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

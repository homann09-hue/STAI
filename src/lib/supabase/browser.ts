import { createClient } from "@supabase/supabase-js";

function isSafePublicSupabaseKey(value: string | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("sb_secret_")) return false;
  if (/service_role/i.test(value)) return false;
  return value.startsWith("sb_publishable_") || value.split(".").length === 3;
}

function isSafeSupabaseUrl(url: string | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSafeSupabaseUrl(url) || !isSafePublicSupabaseKey(anonKey)) return null;

  return createClient(url, anonKey);
}

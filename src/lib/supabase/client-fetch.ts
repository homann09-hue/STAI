"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function getSupabaseAccessToken() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchWithSupabaseAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getSupabaseAccessToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}

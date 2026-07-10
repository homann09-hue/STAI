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
  const targetUrl =
    typeof input === "string"
      ? new URL(input, window.location.origin)
      : input instanceof URL
        ? input
        : new URL(input.url, window.location.origin);
  const sameOrigin = targetUrl.origin === window.location.origin;
  const sameOriginApi = sameOrigin && targetUrl.pathname.startsWith("/api/");
  const token = sameOriginApi ? await getSupabaseAccessToken() : null;

  if (!sameOriginApi) {
    headers.delete("Authorization");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}

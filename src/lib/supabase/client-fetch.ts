"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const pendingSameOriginGetRequests = new Map<string, Promise<Response>>();

function requestMethod(input: RequestInfo | URL, init: RequestInit) {
  if (init.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function requestHasAbortSignal(input: RequestInfo | URL, init: RequestInit) {
  if (init.signal) return true;
  return typeof Request !== "undefined" && input instanceof Request && input.signal !== undefined;
}

function stableHeaderKey(headers: Headers) {
  return Array.from(headers.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");
}

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

  const requestInit = {
    ...init,
    headers
  };
  const canDedupe = sameOriginApi && requestMethod(input, init) === "GET" && !requestHasAbortSignal(input, init);

  if (!canDedupe) return fetch(input, requestInit);

  const requestKey = `${targetUrl.href}\n${stableHeaderKey(headers)}`;
  const pendingRequest = pendingSameOriginGetRequests.get(requestKey);
  if (pendingRequest) return pendingRequest.then((response) => response.clone());

  const request = fetch(input, requestInit);
  pendingSameOriginGetRequests.set(requestKey, request);
  request.then(
    () => {
      if (pendingSameOriginGetRequests.get(requestKey) === request) pendingSameOriginGetRequests.delete(requestKey);
    },
    () => {
      if (pendingSameOriginGetRequests.get(requestKey) === request) pendingSameOriginGetRequests.delete(requestKey);
    }
  );

  return request.then((response) => response.clone());
}

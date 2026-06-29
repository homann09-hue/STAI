export const OFFLINE_KEYS = {
  watchlist: "stockpilot:offline-watchlist",
  analyses: "stockpilot:last-analyses",
  portfolio: "stockpilot:portfolio",
  alerts: "stockpilot:alerts"
} as const;

export function saveOfflineValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      value,
      savedAt: new Date().toISOString()
    })
  );
}

export function readOfflineValue<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { value: T };
    return parsed.value;
  } catch {
    return null;
  }
}

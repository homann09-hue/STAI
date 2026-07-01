export const OFFLINE_KEYS = {
  watchlist: "stockpilot:offline-watchlist",
  analyses: "stockpilot:last-analyses",
  portfolio: "stockpilot:portfolio",
  portfolioBooks: "stockpilot:portfolio-books",
  portfolioTrades: "stockpilot:portfolio-trades",
  alerts: "stockpilot:alerts",
  notificationReadIds: "stockpilot:notification-read-ids",
  onboardingProfile: "stockpilot:onboarding-profile",
  screenerFavorites: "stockpilot:screener-favorites",
  customCalendarEvents: "stockpilot:calendar-events",
  backtests: "stockpilot:backtests",
  analysisWorkbench: "stockpilot:analysis-workbench"
} as const;

const MAX_OFFLINE_PAYLOAD_CHARS = 750000;

export function saveOfflineValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    const payload = JSON.stringify({
      value,
      savedAt: new Date().toISOString()
    });

    if (payload.length > MAX_OFFLINE_PAYLOAD_CHARS) return;
    window.localStorage.setItem(key, payload);
  } catch {
    // Storage may be full, blocked or unavailable in private/offline contexts.
  }
}

export function readOfflineValue<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { value?: T };
    if (!parsed || typeof parsed !== "object" || !("value" in parsed)) return null;
    return parsed.value ?? null;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

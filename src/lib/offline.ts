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
const MAX_OFFLINE_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function removeOfflineValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function isSafeEnvelope<T>(value: unknown): value is { value: T; savedAt: string } {
  if (!value || typeof value !== "object" || !("value" in value) || !("savedAt" in value)) return false;
  const savedAt = (value as { savedAt?: unknown }).savedAt;
  if (typeof savedAt !== "string") return false;
  const timestamp = new Date(savedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= MAX_OFFLINE_AGE_MS;
}

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

  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) return null;

  if (raw.length > MAX_OFFLINE_PAYLOAD_CHARS) {
    removeOfflineValue(key);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isSafeEnvelope<T>(parsed)) {
      removeOfflineValue(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    removeOfflineValue(key);
    return null;
  }
}

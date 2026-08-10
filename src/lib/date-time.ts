export const APP_DISPLAY_TIME_ZONE = "Europe/Berlin";

type DateInput = string | number | Date | null | undefined;

function validDate(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatGermanDate(value: DateInput, fallback = "—") {
  const date = validDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeZone: APP_DISPLAY_TIME_ZONE
  }).format(date);
}

export function formatGermanDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "medium" },
  fallback = "nicht verfügbar"
) {
  const date = validDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("de-DE", {
    ...options,
    timeZone: APP_DISPLAY_TIME_ZONE
  }).format(date);
}


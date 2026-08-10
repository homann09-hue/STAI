import type { MarketStatus } from "@/lib/types";

export type ExchangeCalendarCoverageStatus = "available" | "unavailable";
export type ExchangeCalendarQuality = "provider_reported" | "unavailable";
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ExchangeTradingWindow {
  weekday: IsoWeekday;
  openLocal: string;
  closeLocal: string;
}

export interface ExchangeHoliday {
  date: string;
  name: string;
  isClosed: boolean;
  openLocal: string | null;
  closeLocal: string | null;
}

export interface ExchangeSessionSnapshot {
  status: MarketStatus;
  reason: string;
  localTime: string | null;
  evaluatedAt: string;
}

export interface ExchangeCalendarResult {
  exchange: string;
  name: string | null;
  timezone: string | null;
  regularSchedule: ExchangeTradingWindow[];
  holidays: ExchangeHoliday[];
  session: ExchangeSessionSnapshot;
  available: boolean;
  partial: boolean;
  provider: string | null;
  quality: ExchangeCalendarQuality;
  retrievedAt: string;
  latencyMs: number | null;
  coverage: {
    hours: ExchangeCalendarCoverageStatus;
    holidays: ExchangeCalendarCoverageStatus;
  };
  note: string;
}

type UnknownRecord = Record<string, unknown>;

const weekdayAliases: Record<string, IsoWeekday> = {
  mon: 1,
  monday: 1,
  montag: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  dienstag: 2,
  wed: 3,
  wednesday: 3,
  mittwoch: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  donnerstag: 4,
  fri: 5,
  friday: 5,
  freitag: 5,
  sat: 6,
  saturday: 6,
  samstag: 6,
  sun: 7,
  sunday: 7,
  sonntag: 7
};

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function records(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.flatMap((entry): UnknownRecord[] => {
    const parsed = record(entry);
    return parsed ? [parsed] : [];
  });
  const root = record(value);
  if (!root) return [];
  for (const key of ["data", "results", "hours", "exchanges"]) {
    if (Array.isArray(root[key])) return records(root[key]);
  }
  return [root];
}

function nestedRecords(value: UnknownRecord, depth = 0): UnknownRecord[] {
  if (depth > 2) return [value];
  const nested = Object.values(value).flatMap((entry) => {
    const child = record(entry);
    return child ? nestedRecords(child, depth + 1) : [];
  });
  return [value, ...nested];
}

function firstValue(source: UnknownRecord, keys: readonly string[]) {
  for (const candidate of nestedRecords(source)) {
    for (const key of keys) {
      if (candidate[key] !== undefined && candidate[key] !== null) return candidate[key];
    }
  }
  return undefined;
}

function stringValue(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
}

function isoDate(value: unknown): string | null {
  const candidate = stringValue(value, 32)?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

function validTimezone(value: unknown): string | null {
  const timezone = stringValue(value, 80);
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

export function normalizeLocalClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+(et|est|edt|cet|cest|gmt|utc)$/i, "")
    .replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    if (match[3] === "pm" && hour !== 12) hour += 12;
    if (match[3] === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseWeekday(value: unknown): IsoWeekday | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7) {
    return value as IsoWeekday;
  }
  if (typeof value !== "string") return null;
  return weekdayAliases[value.trim().toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

function parseWeekdays(value: unknown): IsoWeekday[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;/|]+|\s+-\s+|\s+to\s+/i)
      : [];
  const days = raw.flatMap((entry) => parseWeekday(entry) ?? []);
  return [...new Set(days)].sort() as IsoWeekday[];
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value !== "string") return null;
  if (/^(true|yes|closed|1)$/i.test(value.trim())) return true;
  if (/^(false|no|open|0)$/i.test(value.trim())) return false;
  return null;
}

function matchingExchangeRow(raw: unknown, exchange: string): UnknownRecord | null {
  const candidates = records(raw);
  if (candidates.length === 0) return null;
  const normalizedExchange = exchange.toUpperCase();
  return candidates.find((candidate) => {
    const value = stringValue(firstValue(candidate, ["exchange", "exchangeCode", "symbol", "shortName"]));
    return value?.toUpperCase() === normalizedExchange;
  }) ?? candidates[0];
}

export function normalizeFmpExchangeHours(raw: unknown, exchange: string) {
  const row = matchingExchangeRow(raw, exchange);
  if (!row) return null;
  const timezone = validTimezone(firstValue(row, ["timezone", "timeZone", "exchangeTimezoneName", "timezoneName"]));
  const openLocal = normalizeLocalClock(firstValue(row, ["openingHour", "open", "marketOpen", "openingTime", "openTime"]));
  const closeLocal = normalizeLocalClock(firstValue(row, ["closingHour", "close", "marketClose", "closingTime", "closeTime"]));
  const explicitDays = parseWeekdays(firstValue(row, ["tradingDays", "workingDays", "weekdays", "daysOpen", "openDays"]));
  const alwaysOpen = booleanValue(firstValue(row, ["is24Seven", "is24x7", "alwaysOpen"])) === true;
  const weekdays = alwaysOpen ? [1, 2, 3, 4, 5, 6, 7] as IsoWeekday[] : explicitDays;

  if (!timezone || !openLocal || !closeLocal || weekdays.length === 0) return null;
  return {
    name: stringValue(firstValue(row, ["name", "exchangeName", "stockExchangeName", "marketName"])),
    timezone,
    regularSchedule: weekdays.map((weekday) => ({ weekday, openLocal, closeLocal }))
  };
}

function holidayRows(raw: unknown): { validResponse: boolean; rows: UnknownRecord[] } {
  if (Array.isArray(raw)) return { validResponse: true, rows: records(raw) };
  const root = record(raw);
  if (!root) return { validResponse: false, rows: [] };
  for (const key of ["holidays", "data", "results"]) {
    if (Array.isArray(root[key])) return { validResponse: true, rows: records(root[key]) };
  }
  return { validResponse: false, rows: [] };
}

export function normalizeFmpExchangeHolidays(raw: unknown) {
  const parsed = holidayRows(raw);
  const holidays = parsed.rows.flatMap((row): ExchangeHoliday[] => {
    const date = isoDate(firstValue(row, ["date", "holidayDate", "tradingDate"]));
    if (!date) return [];
    const explicitlyClosed = booleanValue(firstValue(row, ["isClosed", "closed", "marketClosed"]));
    const openLocal = normalizeLocalClock(firstValue(row, ["openingHour", "open", "marketOpen", "openingTime"]));
    const closeLocal = normalizeLocalClock(firstValue(row, ["closingHour", "close", "marketClose", "closingTime"]));
    return [{
      date,
      name: stringValue(firstValue(row, ["name", "holiday", "holidayName", "eventName"])) ?? "Börsenfeiertag",
      isClosed: explicitlyClosed ?? !(openLocal && closeLocal),
      openLocal,
      closeLocal
    }];
  });
  return {
    validResponse: parsed.validResponse,
    holidays: [...new Map(holidays.map((holiday) => [holiday.date, holiday])).values()]
      .sort((left, right) => left.date.localeCompare(right.date))
  };
}

function localDateParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = parseWeekday(value("weekday"));
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const time = `${value("hour")}:${value("minute")}`;
  return { weekday, date, time };
}

function clockMinutes(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

export function evaluateExchangeSession(
  schedule: Pick<ExchangeCalendarResult, "timezone" | "regularSchedule" | "holidays" | "coverage">,
  now = new Date()
): ExchangeSessionSnapshot {
  const evaluatedAt = now.toISOString();
  if (!schedule.timezone || schedule.coverage.hours !== "available" || schedule.coverage.holidays !== "available") {
    return {
      status: "unknown",
      reason: "Handelszeiten, Zeitzone oder Feiertagsabdeckung sind unvollständig.",
      localTime: null,
      evaluatedAt
    };
  }

  let local: ReturnType<typeof localDateParts>;
  try {
    local = localDateParts(now, schedule.timezone);
  } catch {
    return { status: "unknown", reason: "Die Provider-Zeitzone ist nicht auswertbar.", localTime: null, evaluatedAt };
  }
  if (!local.weekday || !/^\d{4}-\d{2}-\d{2}$/.test(local.date)) {
    return { status: "unknown", reason: "Die lokale Börsenzeit konnte nicht bestimmt werden.", localTime: null, evaluatedAt };
  }

  const holiday = schedule.holidays.find((entry) => entry.date === local.date);
  if (holiday?.isClosed) {
    return {
      status: "closed",
      reason: `${holiday.name}: Börse laut Provider geschlossen.`,
      localTime: `${local.date} ${local.time} ${schedule.timezone}`,
      evaluatedAt
    };
  }

  const regular = schedule.regularSchedule.find((entry) => entry.weekday === local.weekday);
  const openLocal = holiday?.openLocal ?? regular?.openLocal ?? null;
  const closeLocal = holiday?.closeLocal ?? regular?.closeLocal ?? null;
  if (!openLocal || !closeLocal) {
    return {
      status: "closed",
      reason: "Für diesen Wochentag meldet der Provider kein Handelsfenster.",
      localTime: `${local.date} ${local.time} ${schedule.timezone}`,
      evaluatedAt
    };
  }

  const current = clockMinutes(local.time);
  const open = clockMinutes(openLocal);
  const close = clockMinutes(closeLocal);
  const inside = close > open ? current >= open && current < close : current >= open || current < close;
  return {
    status: inside ? "open" : "closed",
    reason: inside
      ? `Reguläre Sitzung ${openLocal}–${closeLocal} Ortszeit.`
      : `Außerhalb der regulären Sitzung ${openLocal}–${closeLocal} Ortszeit.`,
    localTime: `${local.date} ${local.time} ${schedule.timezone}`,
    evaluatedAt
  };
}

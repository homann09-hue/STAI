"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Database, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { CorporateAction, CorporateActionQuality, CorporateActionType } from "@/lib/corporate-actions";
import type { ExchangeCalendarResult } from "@/lib/exchange-calendar";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";

type UserEventType = "earnings" | "dividend" | "macro" | "split" | "fed";
type CalendarFilter = UserEventType | "corporate_action" | "all";
type EventQuality = CorporateActionQuality | "user";

type CalendarItem = {
  id: string;
  type: UserEventType | "corporate_action";
  title: string;
  symbol: string;
  date: string;
  source: string;
  sourceUrl: string | null;
  quality: EventQuality;
  impact: "hoch" | "mittel" | "niedrig";
  removable: boolean;
};

type UserCalendarEvent = Omit<CalendarItem, "type" | "quality" | "sourceUrl" | "removable"> & {
  type: UserEventType;
  quality: "user";
};

type EventsResponse = {
  available: boolean;
  events: CorporateAction[];
  retrievedAt: string;
  complete: false;
  source: "corporate_actions_ledger" | null;
  note: string;
};

const exchanges = ["NASDAQ", "NYSE", "XETRA", "LSE", "EURONEXT", "TSX", "JPX"] as const;
const types: UserEventType[] = ["earnings", "dividend", "macro", "split", "fed"];
const filters: CalendarFilter[] = ["all", "corporate_action", ...types];
const MAX_CUSTOM_EVENTS = 50;
const MAX_TITLE_LENGTH = 90;
const MAX_SYMBOL_LENGTH = 16;

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function cleanText(value: unknown, maxLength: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || fallback;
}

function cleanSymbol(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, MAX_SYMBOL_LENGTH)
    : "";
}

function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function normalizeUserEvents(value: unknown): UserCalendarEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CUSTOM_EVENTS).flatMap((item, index): UserCalendarEvent[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<UserCalendarEvent>;
    const symbol = cleanSymbol(candidate.symbol);
    if (!symbol || !isValidCalendarDate(candidate.date)) return [];
    return [{
      id: cleanText(candidate.id, 120, `event-${index}`),
      type: candidate.type && types.includes(candidate.type) ? candidate.type : "macro",
      title: cleanText(candidate.title, MAX_TITLE_LENGTH, "Eigener Termin"),
      symbol,
      date: candidate.date,
      source: "Lokaler Nutzertermin",
      quality: "user",
      impact: candidate.impact === "hoch" || candidate.impact === "niedrig" ? candidate.impact : "mittel"
    }];
  });
}

function actionLabel(type: CorporateActionType) {
  const labels: Record<CorporateActionType, string> = {
    cash_dividend: "Bardividende",
    special_dividend: "Sonderdividende",
    stock_dividend: "Aktiendividende",
    split: "Aktiensplit",
    reverse_split: "Reverse Split",
    symbol_change: "Symboländerung",
    merger: "Fusion",
    spin_off: "Abspaltung",
    rights_issue: "Bezugsrecht",
    delisting: "Delisting"
  };
  return labels[type];
}

function providerItem(action: CorporateAction): CalendarItem {
  return {
    id: action.canonicalActionId,
    type: "corporate_action",
    title: actionLabel(action.type),
    symbol: action.symbol,
    date: action.effectiveDate,
    source: action.provider,
    sourceUrl: action.sourceUrl,
    quality: action.quality,
    impact: ["merger", "delisting", "reverse_split", "symbol_change"].includes(action.type) ? "hoch" : "mittel",
    removable: false
  };
}

function qualityLabel(quality: EventQuality) {
  if (quality === "user") return "NUTZERTERMIN";
  if (quality === "issuer_confirmed") return "EMITTENT BESTÄTIGT";
  if (quality === "regulatory_filing") return "REGULATORISCHE MELDUNG";
  return "PROVIDER GEMELDET";
}

function qualityTone(quality: EventQuality) {
  if (quality === "user") return "border-cyan/30 bg-cyan/10 text-cyan";
  if (quality === "provider_reported") return "border-amber/30 bg-amber/10 text-amber";
  return "border-gain/30 bg-gain/10 text-gain";
}

function sessionLabel(status: ExchangeCalendarResult["session"]["status"]) {
  if (status === "open") return "MARKT OFFEN";
  if (status === "closed") return "MARKT GESCHLOSSEN";
  if (status === "pre_market") return "VORBÖRSE";
  if (status === "after_hours") return "NACHBÖRSE";
  return "STATUS UNBEKANNT";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00.000Z`));
}

export function MarketCalendarView() {
  const [customEvents, setCustomEvents] = useState<UserCalendarEvent[]>([]);
  const [providerEvents, setProviderEvents] = useState<EventsResponse | null>(null);
  const [session, setSession] = useState<ExchangeCalendarResult | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSession, setLoadingSession] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [exchange, setExchange] = useState<(typeof exchanges)[number]>("NASDAQ");
  const [title, setTitle] = useState("Eigener Earnings-Termin");
  const [symbol, setSymbol] = useState("AAPL");
  const [date, setDate] = useState(todayInput);
  const [type, setType] = useState<UserEventType>("earnings");

  useEffect(() => {
    setCustomEvents(normalizeUserEvents(readOfflineValue<unknown>(OFFLINE_KEYS.customCalendarEvents)));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 30);
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 335);
    setLoadingEvents(true);
    setEventError(null);
    fetch(`/api/calendar/events?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Kalenderereignisse konnten nicht geladen werden.");
        return response.json() as Promise<EventsResponse>;
      })
      .then(setProviderEvents)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEventError("Kalenderereignisse sind derzeit nicht verfügbar.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEvents(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingSession(true);
    setSessionError(null);
    fetch(`/api/market/calendar?exchange=${encodeURIComponent(exchange)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Börsensitzung konnte nicht geladen werden.");
        return response.json() as Promise<ExchangeCalendarResult>;
      })
      .then(setSession)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSessionError("Börsensitzung ist derzeit nicht verfügbar.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSession(false);
      });
    return () => controller.abort();
  }, [exchange]);

  const events = useMemo(() => {
    const merged: CalendarItem[] = [
      ...customEvents.map((event) => ({ ...event, sourceUrl: null, removable: true })),
      ...(providerEvents?.events ?? []).map(providerItem)
    ];
    return merged
      .filter((event) => filter === "all" || event.type === filter)
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [customEvents, filter, providerEvents]);

  function persist(next: UserCalendarEvent[]) {
    setCustomEvents(next);
    saveOfflineValue(OFFLINE_KEYS.customCalendarEvents, next);
  }

  function addEvent() {
    const cleanTitle = cleanText(title, MAX_TITLE_LENGTH, "Eigener Termin");
    const cleanAsset = cleanSymbol(symbol);
    if (!cleanAsset || !isValidCalendarDate(date)) return;
    const nextEvent: UserCalendarEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: cleanTitle,
      symbol: cleanAsset,
      date,
      source: "Lokaler Nutzertermin",
      quality: "user",
      impact: type === "earnings" || type === "fed" ? "hoch" : "mittel"
    };
    persist([...customEvents, nextEvent].slice(-MAX_CUSTOM_EVENTS));
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-stroke bg-panel/90 p-5 shadow-panel sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan">Belegter Markt- und Ereigniskalender</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Termine ohne Demo-Füllmaterial</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Provider-Termine stammen ausschließlich aus dem Corporate-Action-Ledger. Eigene Termine bleiben lokal auf diesem Gerät. Fehlende globale Abdeckung wird nicht geschätzt.
            </p>
          </div>
          <div className="min-w-52">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted" htmlFor="calendar-exchange">Börsenplatz</label>
            <select id="calendar-exchange" value={exchange} onChange={(event) => setExchange(event.target.value as typeof exchange)} className="mt-2 w-full rounded-xl border border-stroke bg-background px-3 py-2.5 text-sm font-semibold text-foreground">
              {exchanges.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-stroke bg-background/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Clock3 className="h-4 w-4 text-cyan" /> Sitzung {exchange}</div>
              {loadingSession ? <RefreshCw className="h-4 w-4 animate-spin text-muted" /> : null}
            </div>
            {sessionError ? <p className="mt-3 text-sm text-loss">{sessionError}</p> : null}
            {!loadingSession && session ? (
              <div className="mt-3 space-y-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] ${session.session.status === "open" ? "border-gain/30 bg-gain/10 text-gain" : session.session.status === "unknown" ? "border-amber/30 bg-amber/10 text-amber" : "border-stroke bg-white/[0.04] text-muted"}`}>{sessionLabel(session.session.status)}</span>
                <p className="text-sm text-foreground">{session.session.reason}</p>
                <p className="text-xs leading-5 text-muted">{session.session.localTime ?? "Lokale Börsenzeit nicht verfügbar"} · Quelle: {session.provider ?? "nicht verfügbar"}</p>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-stroke bg-background/55 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Database className="h-4 w-4 text-cyan" /> Datenabdeckung</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-stroke p-3"><span className="block text-muted">Handelszeiten</span><strong className="mt-1 block text-foreground">{session?.coverage.hours === "available" ? "Verfügbar" : "Nicht verfügbar"}</strong></div>
              <div className="rounded-xl border border-stroke p-3"><span className="block text-muted">Feiertage</span><strong className="mt-1 block text-foreground">{session?.coverage.holidays === "available" ? "Verfügbar" : "Nicht verfügbar"}</strong></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{session?.note ?? "Datenstatus wird geladen."}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[24px] border border-stroke bg-panel p-5">
          <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-cyan" /><h2 className="font-black text-foreground">Eigenen Termin speichern</h2></div>
          <p className="mt-2 text-xs leading-5 text-muted">Nur lokal auf diesem Gerät. Keine Provider-Bestätigung und keine automatische Benachrichtigung.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-muted">Titel<input value={title} maxLength={MAX_TITLE_LENGTH} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stroke bg-background px-3 py-2.5 text-foreground" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-muted">Symbol<input value={symbol} maxLength={MAX_SYMBOL_LENGTH} onChange={(event) => setSymbol(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stroke bg-background px-3 py-2.5 uppercase text-foreground" /></label>
              <label className="block text-xs font-semibold text-muted">Datum<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stroke bg-background px-3 py-2.5 text-foreground" /></label>
            </div>
            <label className="block text-xs font-semibold text-muted">Typ<select value={type} onChange={(event) => setType(event.target.value as UserEventType)} className="mt-1.5 w-full rounded-xl border border-stroke bg-background px-3 py-2.5 text-foreground">{types.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button type="button" onClick={addEvent} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-110"><Plus className="h-4 w-4" /> Lokal speichern</button>
          </div>
        </div>

        <div className="rounded-[24px] border border-stroke bg-panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan" /><h2 className="font-black text-foreground">Ereignisse</h2></div>
            <select aria-label="Kalender filtern" value={filter} onChange={(event) => setFilter(event.target.value as CalendarFilter)} className="rounded-xl border border-stroke bg-background px-3 py-2 text-xs font-semibold text-foreground">
              {filters.map((item) => <option key={item} value={item}>{item === "all" ? "Alle Typen" : item.replaceAll("_", " ")}</option>)}
            </select>
          </div>

          {loadingEvents ? <div className="mt-5 h-32 animate-pulse rounded-2xl bg-white/[0.04]" aria-label="Kalenderereignisse werden geladen" /> : null}
          {eventError ? <div className="mt-5 rounded-2xl border border-loss/30 bg-loss/10 p-4 text-sm text-loss">{eventError}</div> : null}
          {!loadingEvents && !eventError && providerEvents ? (
            <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${providerEvents.available ? "border-stroke bg-background/40 text-muted" : "border-amber/30 bg-amber/10 text-amber"}`}>
              <strong className="text-foreground">Ledger-Abdeckung: {providerEvents.available ? "verfügbar, unvollständig" : "nicht verfügbar"}.</strong> {providerEvents.note}
            </div>
          ) : null}
          {!loadingEvents && !eventError && events.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-stroke p-7 text-center">
              <p className="font-bold text-foreground">Keine belegten Termine in dieser Ansicht</p>
              <p className="mt-2 text-sm leading-6 text-muted">Es werden bewusst keine Demo-News, Earnings oder Makrotermine ergänzt.</p>
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <article key={event.id} className="rounded-2xl border border-stroke bg-background/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-cyan/10 px-2 py-1 text-xs font-black text-cyan">{event.symbol}</span>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-bold tracking-[0.12em] ${qualityTone(event.quality)}`}>{qualityLabel(event.quality)}</span>
                    </div>
                    <h3 className="mt-2 font-bold text-foreground">{event.title}</h3>
                    <p className="mt-1 text-xs text-muted">{formatDate(event.date)} · Auswirkung: {event.impact} · Quelle: {event.source}</p>
                    {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-cyan hover:underline">Quelle öffnen</a> : null}
                  </div>
                  {event.removable ? <button type="button" aria-label={`${event.title} löschen`} onClick={() => persist(customEvents.filter((item) => item.id !== event.id))} className="rounded-lg border border-stroke p-2 text-muted transition hover:border-loss/40 hover:text-loss"><Trash2 className="h-4 w-4" /></button> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

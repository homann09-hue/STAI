"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { OFFLINE_KEYS, readOfflineValue, saveOfflineValue } from "@/lib/offline";

type CalendarEventType = "earnings" | "dividend" | "macro" | "split" | "fed";

type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  symbol: string;
  date: string;
  source: string;
  quality: "demo" | "user" | "provider_missing";
  impact: "hoch" | "mittel" | "niedrig";
};

const demoEvents: CalendarEvent[] = [
  { id: "demo-nvda", type: "earnings", title: "NVIDIA Earnings Watch", symbol: "NVDA", date: "2026-08-26", source: "Demo-Kalender", quality: "demo", impact: "hoch" },
  { id: "demo-fed", type: "fed", title: "Fed Zinsentscheid", symbol: "USD", date: "2026-07-29", source: "Makro-Struktur", quality: "demo", impact: "hoch" },
  { id: "demo-div", type: "dividend", title: "ETF Ausschüttungsfenster", symbol: "ETF", date: "2026-09-15", source: "Demo-Kalender", quality: "demo", impact: "mittel" }
];

const types: CalendarEventType[] = ["earnings", "dividend", "macro", "split", "fed"];

function qualityTone(quality: CalendarEvent["quality"]) {
  if (quality === "user") return "border-cyan/30 bg-cyan/10 text-cyan";
  if (quality === "demo") return "border-amber/30 bg-amber/10 text-amber";
  return "border-loss/30 bg-loss/10 text-loss";
}

export function MarketCalendarView() {
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<CalendarEventType | "all">("all");
  const [title, setTitle] = useState("Eigener Earnings-Termin");
  const [symbol, setSymbol] = useState("AAPL");
  const [date, setDate] = useState("2026-08-01");
  const [type, setType] = useState<CalendarEventType>("earnings");

  useEffect(() => {
    setCustomEvents(readOfflineValue<CalendarEvent[]>(OFFLINE_KEYS.customCalendarEvents) ?? []);
  }, []);

  useEffect(() => {
    saveOfflineValue(OFFLINE_KEYS.customCalendarEvents, customEvents);
  }, [customEvents]);

  const events = useMemo(() => {
    const allEvents = [...customEvents, ...demoEvents].sort((a, b) => a.date.localeCompare(b.date));
    return filter === "all" ? allEvents : allEvents.filter((event) => event.type === filter);
  }, [customEvents, filter]);

  function addEvent() {
    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 16);
    const cleanTitle = title.trim().replace(/[<>]/g, "").slice(0, 90);
    if (!cleanSymbol || !cleanTitle || !date) return;
    setCustomEvents((current) => [
      {
        id: `event-${Date.now()}`,
        type,
        title: cleanTitle,
        symbol: cleanSymbol,
        date,
        source: "Lokaler Nutzertermin",
        quality: "user",
        impact: "mittel"
      },
      ...current
    ]);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_top_right,rgba(245,201,107,0.14),transparent_34%),linear-gradient(145deg,rgba(12,19,32,0.98),rgba(5,8,14,0.98))] p-5 shadow-panel sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber">Marktkalender MVP</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-mist sm:text-4xl">
          Earnings, Dividenden, Splits und Makro-Termine nutzbar verwalten
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Du kannst eigene Termine lokal speichern. Demo-Termine sind klar markiert, echte Provider-Events
          werden erst als live/near-realtime angezeigt, wenn ein Events-Anbieter angebunden ist.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
          <h2 className="text-lg font-semibold text-mist">Termin hinzufügen</h2>
          <div className="mt-4 grid gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" aria-label="Termin-Titel" />
            <input value={symbol} onChange={(event) => setSymbol(event.target.value)} className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" aria-label="Symbol" />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" aria-label="Datum" />
            <select value={type} onChange={(event) => setType(event.target.value as CalendarEventType)} className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" aria-label="Termin-Typ">
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" onClick={addEvent} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-profit px-4 font-semibold text-ink">
              <Plus className="h-4 w-4" />
              Termin speichern
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-stroke bg-panel/72 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber" />
              <h2 className="text-lg font-semibold text-mist">Event-Liste</h2>
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value as CalendarEventType | "all")} className="h-11 rounded-xl border border-stroke bg-coal px-3 text-mist outline-none focus:border-cyan" aria-label="Event-Typ filtern">
              <option value="all">Alle Events</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <article key={event.id} className="rounded-2xl border border-stroke bg-coal/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${qualityTone(event.quality)}`}>{event.quality.toUpperCase()}</span>
                  <span className="rounded-full border border-stroke px-3 py-1 text-xs text-muted">{event.type}</span>
                  <span className="rounded-full border border-stroke px-3 py-1 text-xs text-muted">Impact {event.impact}</span>
                </div>
                <h3 className="mt-3 font-semibold text-mist">{event.title}</h3>
                <p className="mt-1 text-sm text-muted">{event.symbol} · {new Date(event.date).toLocaleDateString("de-DE")} · Quelle: {event.source}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

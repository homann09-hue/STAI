import type { Metadata } from "next";
import { MarketCalendarView } from "@/components/market-calendar-view";

export const metadata: Metadata = {
  title: "Kalender | StockPilot AI",
  description: "Marktkalender für lokale Termine, Demo-Events und klar gekennzeichnete Earnings-, Dividenden- und Makro-Daten."
};

export default function CalendarPage() {
  return <MarketCalendarView />;
}

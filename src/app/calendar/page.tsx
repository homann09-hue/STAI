import type { Metadata } from "next";
import { MarketCalendarView } from "@/components/market-calendar-view";

export const metadata: Metadata = {
  title: "Kalender | StockPilot AI",
  description: "Earnings, Dividenden, Splits, Makro- und Zentralbanktermine vorbereitet."
};

export default function CalendarPage() {
  return <MarketCalendarView />;
}

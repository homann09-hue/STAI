import type { Metadata } from "next";
import { MacroOverviewView } from "@/components/macro-overview-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Makrolage | StockPilot AI",
  description:
    "Leitzins, Inflation, Renditen und Wechselkurs des Euroraums mit Stichtag, Datenalter und Einordnung der Zinsstruktur. Quelle: EZB Data Portal."
};

export default function MacroPage() {
  return <MacroOverviewView />;
}

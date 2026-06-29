import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = {
  title: "Einstellungen | StockPilot AI",
  description: "Zielgruppen-Modus, Transparenz, Sicherheit und App-Steuerung für StockPilot AI."
};

export default function SettingsPage() {
  return <SettingsView />;
}

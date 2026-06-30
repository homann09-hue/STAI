import { AlertsView } from "@/components/alerts-view";
import { mockAlerts } from "@/lib/mock/market";

export const metadata = {
  title: "Alerts",
  description:
    "Kursalarme, RSI-Signale, Newsalarme, Volumenanstiege, Earnings Reminder und KI-Risikohinweise für beobachtete Assets.",
  robots: {
    index: false,
    follow: false
  }
};

export default function AlertsPage() {
  return <AlertsView initialAlerts={mockAlerts} />;
}

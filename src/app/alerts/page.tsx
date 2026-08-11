import { AlertsView } from "@/components/alerts-view";

export const metadata = {
  title: "Alerts",
  description:
    "Kursalarme, RSI-Signale, Newsalarme, Volumenanstiege, Earnings Reminder und KI-Risiko-Hinweise für beobachtete Assets.",
  robots: {
    index: false,
    follow: false
  }
};

export default function AlertsPage() {
  return <AlertsView initialAlerts={[]} />;
}

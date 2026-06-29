import { AlertsView } from "@/components/alerts-view";
import { mockAlerts } from "@/lib/mock/market";

export const metadata = {
  title: "Alerts"
};

export default function AlertsPage() {
  return <AlertsView initialAlerts={mockAlerts} />;
}

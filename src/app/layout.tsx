import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "StockPilot AI",
    template: "%s | StockPilot AI"
  },
  description:
    "Mobile-first PWA für Aktien-, ETF- und Krypto-Analyse mit Watchlists, Alerts, Portfolio, Scores und KI-Einschätzungen.",
  applicationName: "StockPilot AI",
  appleWebApp: {
    capable: true,
    title: "StockPilot AI",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050706",
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

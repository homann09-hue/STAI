import type { Metadata } from "next";
import { IntelligenceFeed } from "@/components/intelligence-feed";
import { getPublicIntelligenceFeed } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Realtime Intelligence | StockPilot AI",
  description: "Quellenbasierte Unternehmensereignisse mit Bestätigungsstatus, transparenter Bewertung und nachvollziehbaren Fakten."
};

export default async function IntelligencePage() {
  const result = await getPublicIntelligenceFeed({ limit: 100 });
  return <IntelligenceFeed result={result} />;
}

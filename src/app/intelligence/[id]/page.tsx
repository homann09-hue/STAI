import type { Metadata } from "next";
import { IntelligenceDetail } from "@/components/intelligence-detail";
import { getPublicIntelligenceEvent } from "@/lib/intelligence/repository";
import { intelligenceIdSchema } from "@/lib/intelligence/schemas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intelligence-Ereignis | StockPilot AI",
  description: "Vollständige Nachvollziehbarkeit eines quellenbasierten Intelligence-Ereignisses."
};

export default async function IntelligenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = intelligenceIdSchema.safeParse((await params).id);
  if (!parsed.success) return <div className="rounded-2xl border border-loss/25 bg-loss/10 p-5 text-loss">Ungültige Ereignis-ID.</div>;
  const result = await getPublicIntelligenceEvent(parsed.data);
  if (!result.configured || !result.event) {
    return <div className="rounded-2xl border border-amber/25 bg-amber/10 p-5 text-amber">{result.warning ?? "Intelligence-Ereignis nicht gefunden."}</div>;
  }
  return <IntelligenceDetail event={result.event} />;
}

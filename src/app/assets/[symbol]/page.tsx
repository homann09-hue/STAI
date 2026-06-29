import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetDetailView } from "@/components/asset-detail-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const detail = await getMarketDataProvider().getAsset(symbol);

  if (!detail) {
    return {
      title: "Asset nicht gefunden"
    };
  }

  return {
    title: `${detail.asset.symbol} Analyse`,
    description: `${detail.asset.name}: Kurs, Chart, Fundamentaldaten, technische Indikatoren, News und KI-Analyse.`
  };
}

export default async function AssetPage({ params }: PageProps) {
  const { symbol } = await params;
  const detail = await getMarketDataProvider().getAsset(symbol);

  if (!detail) notFound();

  return <AssetDetailView detail={detail} />;
}

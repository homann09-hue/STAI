import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AssetDetailView } from "@/components/asset-detail-view";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { validateSymbol } from "@/lib/validation";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export const dynamic = "force-dynamic";

const getAssetDetail = cache(async (symbol: string) => getMarketDataProvider().getAsset(symbol));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const parsedSymbol = validateSymbol(symbol);

  if (!parsedSymbol.success) {
    return {
      title: "Asset nicht gefunden",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const normalizedSymbol = parsedSymbol.data;
  const detail = await getAssetDetail(normalizedSymbol);

  if (!detail) {
    return {
      title: "Asset nicht gefunden",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const assetUrl = `/assets/${encodeURIComponent(detail.asset.symbol)}`;
  const indexable = detail.quote.quality !== "mock" && detail.quote.quality !== "unavailable";
  const title = `${detail.asset.symbol}: Kurs, Chart, News und Risikoanalyse`;
  const description = `${detail.asset.name} (${detail.asset.symbol}) mit Kurs, Chart, Datenqualität ${detail.quote.quality}, Fundamentaldaten, technischen Signalen, News und KI-Risikoanalyse. Keine Anlageberatung.`;

  return {
    title,
    description,
    alternates: {
      canonical: assetUrl
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: absoluteUrl(assetUrl),
      siteName: siteConfig.name,
      type: "article",
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${detail.asset.symbol} Analyse in StockPilot AI`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${detail.asset.symbol} Analyse`,
      description,
      images: [absoluteUrl("/opengraph-image")]
    },
    robots: {
      index: indexable,
      follow: true,
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1
      }
    }
  };
}

export default async function AssetPage({ params }: PageProps) {
  const { symbol } = await params;
  const parsedSymbol = validateSymbol(symbol);

  if (!parsedSymbol.success) notFound();

  const detail = await getAssetDetail(parsedSymbol.data);

  if (!detail) notFound();

  return <AssetDetailView detail={detail} />;
}

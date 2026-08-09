import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AssetDetailView } from "@/components/asset-detail-view";
import { AssetUnavailableView } from "@/components/asset-unavailable-view";
import { buildValuationView, withImpliedGrowth } from "@/lib/analysis/valuation-view";
import { resolveAssetUnavailability } from "@/lib/asset-availability";
import { fetchFundamentals } from "@/lib/providers/valuation-data";
import { fetchCompanyFilings, fetchInsiderTransactions } from "@/lib/sec/edgar";
import { summarizeInsiderActivity } from "@/lib/sec/form4";
import { findInstrumentIdentityBySymbol } from "@/lib/instrument-master-store";
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

  if (!detail) {
    // Nur ein wirklich unbekanntes Instrument rechtfertigt notFound(). Existiert
    // es im Instrument Master und ist lediglich der Tarif die Ursache, bekommt
    // der Nutzer die bekannten Stammdaten und den echten Grund zu sehen.
    const known = await findInstrumentIdentityBySymbol(parsedSymbol.data);
    const unavailability = resolveAssetUnavailability({ symbol: parsedSymbol.data, known });

    if (unavailability.reason === "unknown_instrument") notFound();

    return <AssetUnavailableView symbol={parsedSymbol.data} unavailability={unavailability} />;
  }

  // Bewertung, Kennzahlen mit Einordnung, Peers und Analysten.
  //
  // Bewusst hier auf dem Server und nicht im Client: die Abschlussdaten sind
  // sieben Abrufe beim Anbieter, und der Nutzer soll die fertige Seite sehen
  // statt sieben nachladende Kacheln. Faellt der Abruf aus, bleibt `valuation`
  // schlicht `null` -- die Seite zeigt dann keinen Bewertungsteil, statt einen
  // leeren.
  const bundle = await fetchFundamentals(parsedSymbol.data, {
    marketCap: detail.fundamentals.marketCap || null,
    price: detail.quote.price
  });

  const valuation = bundle
    ? withImpliedGrowth(
        buildValuationView(bundle, { currency: detail.asset.currency }),
        bundle,
        detail.quote.price
      )
    : null;

  // Filings und Insidertransaktionen (§31/§32).
  //
  // Getrennt vom Bewertungsabruf und mit eigenem Fehlerpfad: die SEC kennt nur
  // US-Emittenten, und für ein europäisches Papier gibt es schlicht keine CIK.
  // Das ist kein Fehler, sondern der Geltungsbereich der Behörde — die
  // Abschnitte entfallen dann.
  const [filings, insider] = await Promise.all([
    fetchCompanyFilings(parsedSymbol.data, { forms: ["10-K", "10-Q", "8-K"], limit: 12 }),
    fetchInsiderTransactions(parsedSymbol.data, 6)
  ]);

  return (
    <AssetDetailView
      detail={detail}
      valuation={valuation}
      filings={filings}
      insider={
        insider
          ? { transactions: insider.transactions, summary: summarizeInsiderActivity(insider.transactions) }
          : null
      }
    />
  );
}

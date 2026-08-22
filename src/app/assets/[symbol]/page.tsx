import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AssetDetailView } from "@/components/asset-detail-view";
import { AssetUnavailableView } from "@/components/asset-unavailable-view";
import { persistCorporateActions } from "@/lib/corporate-action-store";
import { buildValuationView, withImpliedGrowth } from "@/lib/analysis/valuation-view";
import { resolveAssetUnavailability } from "@/lib/asset-availability";
import { fetchFundamentals } from "@/lib/providers/valuation-data";
import { fetchCompanyFilings, fetchInsiderTransactions } from "@/lib/sec/edgar";
import { summarizeInsiderActivity } from "@/lib/sec/form4";
import { resolveInstrumentIdentityBySymbol } from "@/lib/instrument-master-store";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { fetchCorporateActions } from "@/lib/providers/corporate-actions-provider";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { validateSymbol } from "@/lib/validation";

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ canonicalId?: string | string[] }>;
};

export const dynamic = "force-dynamic";

const getAssetDetail = cache(async (symbol: string) => getMarketDataProvider().getAsset(symbol));
const getIdentityResolution = cache((symbol: string, canonicalId: string | null) =>
  resolveInstrumentIdentityBySymbol(symbol, canonicalId),
);

function selectedCanonicalId(value: string | string[] | undefined) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate && isCanonicalInstrumentId(candidate) ? candidate : null;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
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
  const canonicalId = selectedCanonicalId((await searchParams).canonicalId);
  const identityResolution = await getIdentityResolution(normalizedSymbol, canonicalId);
  if (identityResolution.status === "ambiguous" || (canonicalId && identityResolution.status !== "resolved")) {
    return {
      title: `${normalizedSymbol}: Listing auswählen`,
      description: "Für dieses Symbol muss der Handelsplatz eindeutig ausgewählt werden.",
      robots: { index: false, follow: false },
    };
  }
  const detail = await getAssetDetail(normalizedSymbol);

  if (!detail) {
    return {
      title: `${normalizedSymbol}: Daten derzeit nicht verfügbar`,
      description:
        "Das Instrument konnte im unvollständigen Katalog oder beim aktiven Datenanbieter derzeit nicht verifiziert werden.",
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

export default async function AssetPage({ params, searchParams }: PageProps) {
  const { symbol } = await params;
  const parsedSymbol = validateSymbol(symbol);

  if (!parsedSymbol.success) notFound();

  const canonicalId = selectedCanonicalId((await searchParams).canonicalId);
  const identityResolution = await getIdentityResolution(parsedSymbol.data, canonicalId);
  if (identityResolution.status === "ambiguous") {
    return (
      <AssetUnavailableView
        symbol={parsedSymbol.data}
        unavailability={resolveAssetUnavailability({
          symbol: parsedSymbol.data,
          known: null,
          ambiguous: identityResolution.candidates,
        })}
      />
    );
  }
  const known = identityResolution.status === "resolved" ? identityResolution.identity : null;
  if (canonicalId && !known) {
    return (
      <AssetUnavailableView
        symbol={parsedSymbol.data}
        unavailability={resolveAssetUnavailability({ symbol: parsedSymbol.data, known: null })}
      />
    );
  }

  const detail = await getAssetDetail(parsedSymbol.data);

  if (!detail) {
    // Der Katalog ist suchgetrieben und nachweislich unvollstaendig. Deshalb
    // waere selbst ohne Master-Treffer ein 404 eine unbelegte Behauptung. Die
    // Ansicht zeigt stattdessen den bekannten Status und die Datenluecke.
    const unavailability = resolveAssetUnavailability({ symbol: parsedSymbol.data, known });

    return <AssetUnavailableView symbol={parsedSymbol.data} unavailability={unavailability} />;
  }

  // Bewertung, Kennzahlen mit Einordnung, Peers und Analysten.
  //
  // Bewusst hier auf dem Server und nicht im Client: die Abschlussdaten sind
  // sieben Abrufe beim Anbieter, und der Nutzer soll die fertige Seite sehen
  // statt sieben nachladende Kacheln. Faellt der Abruf aus, bleibt `valuation`
  // schlicht `null` -- die Seite zeigt dann keinen Bewertungsteil, statt einen
  // leeren.
  const [bundle, filings, insider, corporateActions] = await Promise.all([
    fetchFundamentals(parsedSymbol.data, {
      marketCap: detail.fundamentals.marketCap || null,
      price: detail.quote.price
    }),
    fetchCompanyFilings(parsedSymbol.data, { forms: ["10-K", "10-Q", "8-K"], limit: 12 }),
    fetchInsiderTransactions(parsedSymbol.data, 6),
    fetchCorporateActions(parsedSymbol.data, new Date(), detail.asset.type)
  ]);

  // Der Ledger ist Referenzdatenbestand. Ein Persistenzfehler darf die
  // sichtbare Providerantwort nicht vernichten; der Store protokolliert ihn.
  await persistCorporateActions(corporateActions.actions);

  const valuation = bundle
    ? withImpliedGrowth(
        buildValuationView(bundle, { currency: detail.asset.currency }),
        bundle,
        detail.quote.price
      )
    : null;

  return (
    <AssetDetailView
      detail={detail}
      valuation={valuation}
      filings={filings}
      corporateActions={corporateActions}
      insider={
        insider
          ? { transactions: insider.transactions, summary: summarizeInsiderActivity(insider.transactions) }
          : null
      }
    />
  );
}

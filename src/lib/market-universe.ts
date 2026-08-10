import "server-only";

import { instrumentCatalogHitToUniverse, type InstrumentCatalogCoverage } from "@/lib/instrument-catalog";
import { searchInstrumentCatalog } from "@/lib/instrument-catalog-service";
import type {
  MarketUniverseAssetClass,
  MarketUniverseCoverage,
  MarketUniverseInstrument
} from "@/lib/types";

export const marketUniverseCoverage: MarketUniverseCoverage[] = [
  {
    label: "Aktien und ETFs",
    assetClasses: ["stock", "etf", "fund"],
    exchanges: ["Providerabhaengig"],
    providerCandidates: ["FMP", "Finnhub", "Twelve Data", "EODHD", "Massive"],
    status: "license_required",
    note: "Der aktive FMP-Tarif erlaubt Suche, aber keinen vollstaendigen Verzeichnisabruf. Realtime- und Anzeigerechte sind boersenabhaengig."
  },
  {
    label: "Krypto",
    assetClasses: ["crypto"],
    exchanges: ["Binance", "Coinbase"],
    providerCandidates: ["Binance", "Coinbase", "FMP"],
    status: "prepared",
    note: "Public Quotes sind technisch vorbereitet; ein lizenzierter, vollstaendiger Instrumentkatalog ist nicht aktiviert."
  },
  {
    label: "Indizes, Forex und Rohstoffe",
    assetClasses: ["index", "forex", "commodity"],
    exchanges: ["Providerabhaengig"],
    providerCandidates: ["FMP", "Twelve Data", "EODHD", "Databento"],
    status: "license_required",
    note: "Instrumente werden nur aus echten Provider-Treffern uebernommen; fehlende Abdeckung wird nicht mit Seed-Daten aufgefuellt."
  },
  {
    label: "Anleihen und Derivate",
    assetClasses: ["bond", "future", "option", "warrant"],
    exchanges: ["CME", "ICE", "Eurex", "OPRA", "OTC"],
    providerCandidates: ["Databento", "Massive", "EODHD", "lizenzierte Boersenfeeds"],
    status: "license_required",
    note: "Schema und Filter sind vorbereitet. Produktive Instrument- und Kursdaten bleiben bis zur Provider- und Lizenzfreigabe deaktiviert."
  }
];

export interface UniverseSearchInput {
  query?: string;
  assetClass?: MarketUniverseAssetClass | "all";
  limit?: number;
}

export interface UniverseSearchResult {
  instruments: MarketUniverseInstrument[];
  coverage: MarketUniverseCoverage[];
  catalogCoverage: InstrumentCatalogCoverage;
  provider: string;
  updatedAt: string;
  disclaimer: string;
}

export interface UniverseProvider {
  readonly providerName: string;
  search(input?: UniverseSearchInput): Promise<UniverseSearchResult>;
}

class InstrumentMasterUniverseProvider implements UniverseProvider {
  readonly providerName = "FMP + StockPilot Instrument Master";

  async search(input: UniverseSearchInput = {}): Promise<UniverseSearchResult> {
    const catalog = await searchInstrumentCatalog(input);

    return {
      instruments: catalog.results.map(instrumentCatalogHitToUniverse),
      coverage: marketUniverseCoverage,
      catalogCoverage: catalog.coverage,
      provider: catalog.provider,
      updatedAt: catalog.receivedAt,
      disclaimer:
        "Nur persistierte Instrumente und echte Provider-Suchergebnisse. Das Verzeichnis ist im aktiven Tarif unvollstaendig; es werden keine statischen Ersatzinstrumente angezeigt."
    };
  }
}

export function getMarketUniverseProvider(): UniverseProvider {
  return new InstrumentMasterUniverseProvider();
}

export async function getMarketUniverse(input: UniverseSearchInput = {}) {
  return (await getMarketUniverseProvider().search(input)).instruments;
}

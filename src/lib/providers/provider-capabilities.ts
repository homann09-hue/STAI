import {
  resolveProviderRoute,
  type ProviderAssetClass,
} from "@/lib/providers/provider-registry";
import type { AssetType } from "@/lib/types";

export type AssetClassQuoteCoverage = {
  assetClass: AssetType;
  providers: string[];
  hasFailover: boolean;
  note: string;
};

function registryAssetClass(assetClass: AssetType): ProviderAssetClass {
  return assetClass === "stock" ? "equity" : assetClass;
}

/**
 * Berechnet die tatsaechlich routbare Quote-Kette fuer genau eine Assetklasse.
 *
 * Die Funktion prueft Adapterstatus, Konfiguration, Enable-Flags, Lizenzstatus
 * und Provider-Health ueber die zentrale Registry. Eine statische Providerliste
 * waere fuer den Admin-Bereich irrefuehrend, weil sie auch gesperrte oder nicht
 * konfigurierte Quellen als Redundanz zaehlen wuerde.
 */
export function resolveQuoteChainForAssetClass(
  assetClass: AssetType,
  env: NodeJS.ProcessEnv = process.env,
): AssetClassQuoteCoverage {
  const decision = resolveProviderRoute(
    {
      capability: "quote",
      assetClass: registryAssetClass(assetClass),
      market: assetClass === "crypto" ? undefined : "global",
    },
    env,
  );
  // FMP ist in StockPilot aktuell nicht als belastbare Forex-Quelle
  // freigegeben. Die generische Registry kennt die vorbereitete Assetklasse,
  // die Betriebsabdeckung darf daraus aber keinen produktiven Failover machen.
  const providers = decision.providers.filter(
    (provider) => !(assetClass === "forex" && provider === "fmp"),
  );
  const rightsBlocked = decision.rejected.some(
    (entry) => entry.reason === "license_not_verified",
  );

  return {
    assetClass,
    providers,
    hasFailover: providers.length > 1,
    note:
      providers.length > 1
        ? `${providers.length} routbare Quellen; technischer Failover vorhanden.`
        : providers.length === 1
          ? "Eine routbare Quelle; kein technischer Provider-Failover."
          : rightsBlocked
            ? "Keine externen Kursrechte fuer diese Assetklasse verifiziert."
            : "Keine konfigurierte und routbare Kursquelle fuer diese Assetklasse.",
  };
}

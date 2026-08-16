import type { MacroDataLifecycle } from "@/lib/macro/analysis";
import type { MacroObservation } from "@/lib/macro/sdmx";
import type { MacroSeriesDefinition } from "@/lib/macro/series";

/** Übersetzt die SDMX-Historie in das providerübergreifende Lebenszyklusmodell. */
export function toEcbDataLifecycle(
  observations: readonly MacroObservation[],
  series: MacroSeriesDefinition
): MacroDataLifecycle | undefined {
  const latest = observations.at(-1);
  if (!latest) return undefined;
  const initialValue = latest.initialValue ?? null;
  return {
    seriesKey: `${series.resource}.${series.key}`,
    frequency: series.frequency,
    unit: series.unit,
    region: series.region,
    provider: series.source,
    observationTime: latest.period,
    releaseTime: latest.releaseTime ?? null,
    vintageAsOf: latest.vintageAsOf ?? null,
    revisionState: latest.revisionState ?? "not_available",
    initialValue,
    revisionDelta: initialValue === null ? null : Number((latest.value - initialValue).toFixed(6))
  };
}

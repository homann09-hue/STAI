import { AlertTriangle } from "lucide-react";
import { getDataQualityDisplay } from "@/lib/data-quality";
import type { MarketDataQuality, MarketStatus } from "@/lib/types";

type DataQualityProps = {
  quality: MarketDataQuality;
  marketStatus?: MarketStatus;
  delayedByMinutes?: number;
  fromCache?: boolean;
  offline?: boolean;
  compact?: boolean;
};

export function DataQualityBadge({
  quality,
  marketStatus = "unknown",
  delayedByMinutes,
  fromCache,
  offline,
  compact = false
}: DataQualityProps) {
  const display = getDataQualityDisplay({ quality, marketStatus, delayedByMinutes, fromCache, offline });

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${display.tone}`}>
      {compact ? display.shortLabel : display.label}
    </span>
  );
}

export function DataQualityNotice({
  quality,
  marketStatus = "unknown",
  delayedByMinutes,
  fromCache,
  offline,
  provider,
  updatedAt,
  title = "Datenstatus"
}: DataQualityProps & {
  provider?: string;
  updatedAt?: string;
  title?: string;
}) {
  const display = getDataQualityDisplay({ quality, marketStatus, delayedByMinutes, fromCache, offline });
  const formattedUpdatedAt = updatedAt
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(updatedAt))
    : "nicht verfügbar";

  return (
    <div className={`rounded-2xl border p-3 text-xs leading-5 ${display.tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="font-semibold">{title}</span>
        <DataQualityBadge
          quality={quality}
          marketStatus={marketStatus}
          delayedByMinutes={delayedByMinutes}
          fromCache={fromCache}
          offline={offline}
        />
      </div>
      <p className="mt-2">{display.warning ?? "Datenquelle meldet einen nutzbaren Status. Trotzdem Quelle und Zeitstempel prüfen."}</p>
      <p className="mt-1 opacity-80">
        Provider: {provider ?? "nicht verfügbar"} · Letzte Aktualisierung: {formattedUpdatedAt}
      </p>
    </div>
  );
}

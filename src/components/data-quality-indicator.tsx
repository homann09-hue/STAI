import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { getDataQualityDisplay } from "@/lib/data-quality";
import { formatGermanDateTime } from "@/lib/date-time";
import type { MarketDataQuality, MarketStatus, NormalizedQuote } from "@/lib/types";

type DataQualityProps = {
  quality: MarketDataQuality;
  marketStatus?: MarketStatus;
  delayedByMinutes?: number | null;
  fromCache?: boolean;
  offline?: boolean;
  compact?: boolean;
};

function formatUpdatedAt(updatedAt?: string) {
  return formatGermanDateTime(updatedAt);
}

function safeProvider(provider?: string) {
  const normalized = provider?.trim();
  return normalized ? normalized.slice(0, 80) : "nicht verfügbar";
}

type QuoteVerification = Pick<
  NormalizedQuote,
  "provider" | "qualityIssues" | "qualityScore" | "qualityStatus"
>;

type VerificationDisplay = {
  label: string;
  description: string;
  tone: string;
  icon: typeof ShieldCheck;
};

export function getQuoteVerificationDisplay(
  quote?: QuoteVerification,
): VerificationDisplay | null {
  if (!quote) return null;

  const issues = quote.qualityIssues.map((issue) => issue.toLowerCase());
  const hasIssue = (fragment: string) =>
    issues.some((issue) => issue.includes(fragment));

  if (quote.qualityStatus === "DIVERGENT" || hasIssue("diverg")) {
    return {
      label: "Quellen weichen ab",
      description:
        "Vergleichbare Anbieter melden erheblich unterschiedliche Kurse. Angezeigt bleibt der Primärkurs; eine Analyse auf dieser Basis ist gesperrt.",
      tone: "border-loss/35 bg-loss/10 text-loss",
      icon: ShieldAlert,
    };
  }

  if (hasIssue("stale")) {
    return {
      label: "Vergleich veraltet",
      description:
        "Die Zeitstempel der Anbieter liegen zu weit auseinander. Der Kurs gilt nicht als unabhängig bestätigt.",
      tone: "border-amber/35 bg-amber/10 text-amber",
      icon: ShieldQuestion,
    };
  }

  if (hasIssue("incompar")) {
    return {
      label: "Nicht vergleichbar",
      description:
        "Eine zweite Quelle ist vorhanden, aber Instrument, Währung oder Marktphase sind nicht direkt vergleichbar.",
      tone: "border-amber/35 bg-amber/10 text-amber",
      icon: ShieldQuestion,
    };
  }

  if (hasIssue("confirm")) {
    return {
      label: "Quellen bestätigt",
      description:
        "Eine zweite vergleichbare Quelle liegt innerhalb der zulässigen Toleranz. Angezeigt bleibt unverändert der Primärkurs.",
      tone: "border-profit/35 bg-profit/10 text-profit",
      icon: ShieldCheck,
    };
  }

  if (hasIssue("single_provider") || hasIssue("single_source")) {
    return {
      label: "Einzelquelle",
      description:
        "Für diesen Kurs liegt nur eine verwertbare Quelle vor. Eine unabhängige Bestätigung ist nicht verfügbar.",
      tone: "border-stroke bg-panel text-muted",
      icon: ShieldQuestion,
    };
  }

  return null;
}

export function QuoteVerificationBadge({
  quote,
}: {
  quote?: QuoteVerification;
}) {
  const display = getQuoteVerificationDisplay(quote);
  if (!display) return null;

  const Icon = display.icon;

  return (
    <span
      aria-label={`Kursprüfung: ${display.label}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${display.tone}`}
      title={display.description}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {display.label}
    </span>
  );
}

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
  const formattedUpdatedAt = formatUpdatedAt(updatedAt);

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
        Provider: {safeProvider(provider)} · Letzte Aktualisierung: {formattedUpdatedAt}
      </p>
    </div>
  );
}

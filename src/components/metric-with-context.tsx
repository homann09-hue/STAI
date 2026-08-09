"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { bandTone, type MetricContextResult } from "@/lib/analysis/metric-context";

/**
 * Eine Kennzahl mit Erklärung und historischer Einordnung.
 *
 * §50 verlangt vier Dinge: Tooltip, kurze Erklärung, Kontext und historische
 * Einordnung. Der Satz darunter ist der eigentliche Inhalt:
 *
 * ```
 * KGV 34,1
 * deutlich über dem 5-Jahres-Median von 27,8
 * ```
 *
 * **Die Einordnung steht immer sichtbar, der Rest im Tooltip.** Eine Erklärung,
 * die man erst aufklappen muss, wird nicht gelesen — der Vergleich mit der
 * eigenen Vergangenheit ist aber genau das, was die Zahl erst verständlich
 * macht.
 *
 * Der Tooltip ist bewusst kein reines `title`-Attribut: das erscheint auf
 * Berührungsgeräten nie. Er lässt sich antippen und ist damit auch mobil
 * erreichbar.
 */

const toneClass = {
  favourable: "text-profit",
  unfavourable: "text-loss",
  neutral: "text-muted"
} as const;

export function MetricWithContext({ result }: { result: MetricContextResult }) {
  const [open, setOpen] = useState(false);
  const tone = toneClass[bandTone(result)];
  const { definition } = result;

  // Der Wert allein, ohne die Wiederholung des Labels aus `sentence`.
  const contextText = result.sentence.startsWith(`${definition.label} `)
    ? result.sentence.slice(definition.label.length + 1).replace(/^[^—]*—\s*/, "")
    : result.sentence;

  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{definition.label}</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Erklärung zu ${definition.label} ${open ? "schließen" : "anzeigen"}`}
          className="shrink-0 rounded-md p-1 text-muted transition-colors hover:text-cyan"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-1 font-mono text-lg font-semibold text-mist">{result.formatted}</p>

      {/* Die historische Einordnung -- immer sichtbar, nie im Tooltip versteckt. */}
      <p className={`mt-1 text-[11px] leading-4 ${result.band === "unknown" ? "text-muted" : tone}`}>
        {result.value === null || result.median === null ? contextText : contextText}
      </p>

      {open ? (
        <div className="mt-3 space-y-2 rounded-xl border border-stroke bg-panel/70 p-3 text-[11px] leading-5 text-muted">
          <p>{definition.explanation}</p>
          <p>
            <span className="font-semibold text-mist">Warum das zählt: </span>
            {definition.whyItMatters}
          </p>
          {/* Der Vorbehalt ist bei vielen Kennzahlen der wichtigste Teil. */}
          <p className="text-amber">
            <span className="font-semibold">Was die Zahl nicht sagt: </span>
            {definition.caveat}
          </p>
          {result.median !== null ? (
            <p>
              Vergleichsgrundlage: {result.years} Geschäftsjahre. Mehr gibt der Anbietertarif nicht her.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mehrere Kennzahlen als Raster.
 *
 * Kennzahlen ohne Wert werden **mitgezeigt** statt weggelassen. Eine Lücke im
 * Raster ist eine Auskunft; ein stillschweigend fehlendes Feld sieht aus, als
 * gäbe es die Kennzahl nicht.
 */
export function MetricGrid({ results }: { results: (MetricContextResult | null)[] }) {
  const usable = results.filter((result): result is MetricContextResult => result !== null);

  if (usable.length === 0) {
    return <p className="text-sm text-muted">Für dieses Instrument liegen keine Kennzahlen vor.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {usable.map((result) => (
        <MetricWithContext key={result.definition.id} result={result} />
      ))}
    </div>
  );
}

"use client";

import { Newspaper } from "lucide-react";
import Link from "next/link";
import { DataQualityBadge } from "@/components/data-quality-indicator";
import { sentimentTone } from "@/lib/scoring";
import type { NewsItem } from "@/lib/types";

const sentimentLabels = {
  positive: "Positiv",
  neutral: "Neutral",
  negative: "Negativ"
};

function safeExternalUrl(rawUrl: string | undefined) {
  if (!rawUrl || rawUrl === "#") return null;

  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <div className="space-y-3">
      {news.map((item) => {
        const isMock = item.source.toLowerCase().includes("mock") || item.url === "#";
        const sourceUrl = safeExternalUrl(item.url);

        return (
          <article key={item.id} className="rounded-md border border-stroke bg-panel p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cyan/10 text-cyan">
                <Newspaper className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-[11px] ${sentimentTone(item.sentiment)}`}>
                    {sentimentLabels[item.sentiment]}
                  </span>
                  <DataQualityBadge quality={isMock ? "mock" : "near_realtime"} marketStatus="unknown" compact />
                  <span className="text-xs text-muted">{item.source}</span>
                  <span className="text-xs text-muted">
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short"
                    }).format(new Date(item.publishedAt))}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-mist">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>

                {/* Ereignisarten mit ihrem Beleg. Der ausloesende Wortlaut steht
                    im Titelattribut -- ohne ihn waere die Einordnung eine
                    Behauptung ohne Nachweis. */}
                {item.events.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {item.events.map((event) => (
                      <span
                        key={event.type}
                        title={`Erkannt an: „${event.matchedText}"`}
                        className="rounded-md border border-cyan/25 bg-cyan/10 px-2 py-1 text-cyan"
                      >
                        {event.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {item.subjects.length ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {item.subjects.slice(0, 6).map((subject) => (
                      <span
                        key={`${subject.type}:${subject.id}`}
                        // Abgeleitete Bezuege werden gedaempft dargestellt: sie
                        // stammen nicht vom Anbieter, sondern aus dem Symbol.
                        className={`rounded-md px-2 py-1 ${
                          subject.origin === "provider" ? "bg-panel2 text-muted" : "bg-panel2/50 text-muted/70"
                        }`}
                      >
                        {subject.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                    {item.relevance === null
                      ? "Relevanz: keine Angabe der Quelle"
                      : `Übereinstimmung ${item.relevance} (Anbieterwert)`}
                  </span>
                  {item.impactScore === null ? null : (
                    <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                      Kursauswirkung {item.impactScore > 0 ? "+" : ""}
                      {item.impactScore}
                    </span>
                  )}
                  {item.duplicateSources.length ? (
                    <span
                      title={item.duplicateSources.join(", ")}
                      className="rounded-md bg-panel2 px-2 py-1 text-muted"
                    >
                      +{item.duplicateSources.length} weitere Quelle
                      {item.duplicateSources.length === 1 ? "" : "n"}
                    </span>
                  ) : null}
                  {sourceUrl ? (
                    <Link className="rounded-md bg-panel2 px-2 py-1 text-cyan" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      Quelle öffnen
                    </Link>
                  ) : null}
                </div>
                {isMock ? (
                  <p className="mt-3 rounded-md border border-amber/25 bg-amber/10 p-2 text-xs leading-5 text-amber">
                    Mock-News: Diese Meldung dient der Produktdemo und darf nicht als echte Nachricht oder Fakt interpretiert werden.
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

"use client";

import { Newspaper } from "lucide-react";
import { sentimentTone } from "@/lib/scoring";
import type { NewsItem } from "@/lib/types";

const sentimentLabels = {
  positive: "Positiv",
  neutral: "Neutral",
  negative: "Negativ"
};

export function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <div className="space-y-3">
      {news.map((item) => (
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
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                  Relevanz {item.relevance}/100
                </span>
                <span className="rounded-md bg-panel2 px-2 py-1 text-muted">
                  Kursauswirkung {item.impactScore > 0 ? "+" : ""}
                  {item.impactScore}
                </span>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

import type { RefreshInterval } from "@/lib/types";

export const refreshIntervals: Array<{ label: string; value: RefreshInterval; description: string }> = [
  { label: "10 Sekunden", value: 10000, description: "Standard REST-Fallback für Near-Realtime." },
  { label: "30 Sekunden", value: 30000, description: "Ausgewogen für Dashboard und Watchlist." },
  { label: "60 Sekunden", value: 60000, description: "Schonend bei Rate-Limits oder Markt geschlossen." },
  { label: "5 Minuten", value: 300000, description: "Sparmodus für Hintergrundnutzung." }
];

export const refreshProfiles = [
  {
    key: "standard",
    label: "Standard",
    intervalMs: 10000 as RefreshInterval,
    description: "10 Sekunden für sichtbare Assets, mit Anbieterlimits und Backoff."
  },
  {
    key: "balanced",
    label: "Ausgewogen",
    intervalMs: 30000 as RefreshInterval,
    description: "30 Sekunden für Dashboard und Watchlist bei normalen Marktbewegungen."
  },
  {
    key: "eco",
    label: "Sparsam",
    intervalMs: 60000 as RefreshInterval,
    description: "60 Sekunden bis 5 Minuten, reduziert Last bei Hintergrund-Tabs."
  },
  {
    key: "manual",
    label: "Manuell",
    intervalMs: undefined,
    description: "Keine automatische Aktualisierung, Nutzer startet Refresh bewusst."
  }
] as const;

export const defaultRefreshIntervalMs = 10000 as RefreshInterval;

import type { RefreshInterval } from "@/lib/types";

export const refreshIntervals: Array<{ label: string; value: RefreshInterval; description: string }> = [
  { label: "1 Sekunde", value: 1000, description: "High-Frequency Debug/Pro, nur bei passenden Anbieterlimits." },
  { label: "5 Sekunden", value: 5000, description: "Schnell, gut fuer aktive Detailseiten und Krypto." },
  { label: "10 Sekunden", value: 10000, description: "Standard REST-Fallback fuer Near-Realtime." },
  { label: "30 Sekunden", value: 30000, description: "Ausgewogen fuer Dashboard und Watchlist." },
  { label: "60 Sekunden", value: 60000, description: "Schonend bei Rate-Limits oder Markt geschlossen." },
  { label: "5 Minuten", value: 300000, description: "Sparmodus fuer Hintergrundnutzung." }
];

export const refreshProfiles = [
  {
    key: "fast",
    label: "Schnell",
    intervalMs: 5000 as RefreshInterval,
    description: "5-10 Sekunden, priorisiert sichtbare Assets und Detailseiten."
  },
  {
    key: "standard",
    label: "Standard",
    intervalMs: 10000 as RefreshInterval,
    description: "10-30 Sekunden, beste Balance aus Aktualitaet und Anbieterlimits."
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

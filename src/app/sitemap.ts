import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/markets", priority: 0.95, changeFrequency: "hourly" },
  { path: "/stocks", priority: 0.9, changeFrequency: "hourly" },
  { path: "/etfs", priority: 0.9, changeFrequency: "daily" },
  { path: "/crypto", priority: 0.9, changeFrequency: "hourly" },
  { path: "/indices", priority: 0.85, changeFrequency: "hourly" },
  { path: "/screener", priority: 0.85, changeFrequency: "daily" },
  { path: "/news-terminal", priority: 0.8, changeFrequency: "hourly" },
  { path: "/calendar", priority: 0.65, changeFrequency: "daily" },
  { path: "/analyses", priority: 0.75, changeFrequency: "daily" },
  { path: "/compare", priority: 0.7, changeFrequency: "daily" },
  { path: "/risk", priority: 0.7, changeFrequency: "daily" },
  { path: "/backtesting", priority: 0.65, changeFrequency: "weekly" },
  { path: "/learn", priority: 0.8, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.65, changeFrequency: "monthly" }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}

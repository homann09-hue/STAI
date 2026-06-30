import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/markets",
        "/stocks",
        "/etfs",
        "/crypto",
        "/indices",
        "/screener",
        "/news-terminal",
        "/calendar",
        "/analyses",
        "/compare",
        "/risk",
        "/backtesting",
        "/learn",
        "/pricing",
        "/assets/"
      ],
      disallow: ["/api/", "/offline", "/settings", "/portfolio", "/watchlist", "/alerts"]
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/")
  };
}

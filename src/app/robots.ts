import type { MetadataRoute } from "next";
import { canonicalBase } from "@/server/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Persoenliche Danke-Seiten und interne Bereiche gehoeren nicht in den Index.
      disallow: ["/danke/", "/dashboard", "/admin", "/api/", "/zahlung/"],
    },
    sitemap: `${canonicalBase()}/sitemap.xml`,
  };
}

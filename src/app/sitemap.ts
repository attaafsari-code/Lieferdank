import type { MetadataRoute } from "next";
import { canonicalBase } from "@/server/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/fahrer",
    "/so-funktionierts",
    "/faq",
    "/register",
    "/kontakt",
  ];
  const now = new Date();
  return routes.map((route) => ({
    url: `${canonicalBase()}${route}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));
}

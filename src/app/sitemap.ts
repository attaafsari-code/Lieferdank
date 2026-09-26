import type { MetadataRoute } from "next";
import { canonicalBase } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/fahrer",
    "/so-funktionierts",
    "/faq",
    "/register",
    "/login",
    "/legal/impressum",
    "/legal/datenschutz",
    "/legal/agb",
  ];
  const now = new Date();
  return routes.map((route) => ({
    url: `${canonicalBase()}${route}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));
}

import type { MetadataRoute } from "next";

/** Web-App-Manifest: installierbar auf iOS und Android, startet wie eine App. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Lieferdank",
    short_name: "Lieferdank",
    description: "Dein Danke kommt an. Danke-Code für Lieferanten, Danke und Trinkgeld für Kunden.",
    start_url: "/app?quelle=homescreen",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1a5ce0",
    lang: "de-DE",
    categories: ["finance", "lifestyle", "business"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Meine Karte", short_name: "Karte", url: "/dashboard/karte", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Einnahmen", short_name: "Einnahmen", url: "/dashboard/einnahmen", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Meine Lieferanten", short_name: "Lieferanten", url: "/konto", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

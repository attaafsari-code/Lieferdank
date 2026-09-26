import "server-only";
import { networkInterfaces } from "node:os";

/**
 * Adressen der Anwendung.
 *
 * `baseUrl()` liefert die Adresse, unter der ein Handy die Seite tatsächlich
 * erreicht -- das ist die Adresse, die in den QR-Code muss.
 * `canonicalBase()` liefert die öffentliche Marken-Adresse für SEO.
 */

export const PRODUCTION_URL = "https://lieferdank.de";

function clean(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Erste nicht-lokale IPv4-Adresse dieses Rechners, z. B. 192.168.1.42. */
function lanAddress(): string | null {
  try {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === "IPv4" && !address.internal) return address.address;
      }
    }
  } catch {
    // Auf gesperrten Hosts nicht abfragbar -- dann eben localhost.
  }
  return null;
}

/**
 * Basis-URL für QR-Codes und Rücksprung-Adressen.
 *
 * Reihenfolge:
 *  1. NEXT_PUBLIC_BASE_URL -- explizit gesetzt, gewinnt immer
 *  2. Vercel-Deployment-Adresse
 *  3. In der Entwicklung die LAN-Adresse, damit ein Handy im selben WLAN
 *     den QR-Code wirklich scannen kann. `localhost` wäre dort wertlos.
 *  4. localhost
 */
export function baseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return clean(explicit);

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const port = process.env.PORT ?? "3000";
  if (process.env.NODE_ENV !== "production") {
    const lan = lanAddress();
    if (lan) return `http://${lan}:${port}`;
  }
  return `http://localhost:${port}`;
}

/** Öffentliche Adresse für canonical-Links, Sitemap und Metadaten. */
export function canonicalBase(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return clean(explicit);
  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;
  return baseUrl();
}

export function canonical(path = "/"): string {
  return `${canonicalBase()}${path === "/" ? "" : path}`;
}

/**
 * Wie öffentlich ist die Adresse, die in den QR-Codes landet?
 *
 *  - "public"    erreichbar aus dem Internet -- druckreif
 *  - "lan"       nur im selben WLAN erreichbar -- gut zum Testen, nicht zum Drucken
 *  - "localhost" nur auf diesem Rechner -- ein QR-Code damit ist wertlos
 */
export type BaseUrlKind = "public" | "lan" | "localhost";

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
];

export function baseUrlKind(): BaseUrlKind {
  let host: string;
  try {
    host = new URL(baseUrl()).hostname;
  } catch {
    return "localhost";
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "localhost";
  if (PRIVATE_RANGES.some((range) => range.test(host))) return "lan";
  return "public";
}

/** Kurzform: Ist die Adresse für gedruckte Karten geeignet? */
export function isPrintReadyBaseUrl(): boolean {
  return baseUrlKind() === "public";
}

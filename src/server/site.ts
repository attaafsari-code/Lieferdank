import "server-only";
import { networkInterfaces } from "node:os";
import { classifyUrl, PRODUCTION_URL, resolveBaseUrl, type BaseUrlKind } from "@/lib/base-url";

export { PRODUCTION_URL, type BaseUrlKind };

function lanAddress(): string | null {
  try {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.family === "IPv4" && !address.internal) return address.address;
      }
    }
  } catch {
    // Auf gesperrten Hosts nicht abfragbar.
  }
  return null;
}

let warned = false;

/** Adresse, die in QR-Codes und Rücksprung-Links landet. */
export function baseUrl(): string {
  const resolved = resolveBaseUrl(
    {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      PORT: process.env.PORT,
    },
    process.env.NODE_ENV === "production" ? null : lanAddress(),
  );
  if (resolved.warning && !warned) {
    warned = true;
    console.error(`[base-url] ${resolved.warning}`);
  }
  return resolved.url;
}

/** Öffentliche Marken-Adresse für canonical, Sitemap und Metadaten. */
export function canonicalBase(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;
  return baseUrl();
}

export function baseUrlKind(): BaseUrlKind {
  return classifyUrl(baseUrl());
}

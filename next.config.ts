import path from "node:path";
import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * LAN-Adressen dieses Rechners. Im Entwicklungsmodus blockiert Next.js sonst
 * Anfragen von fremden Hosts – ein Handy im WLAN könnte die per QR-Code
 * geöffnete Seite zwar laden, aber keinen Button bedienen.
 */
function lanAddresses(): string[] {
  try {
    return Object.values(networkInterfaces())
      .flat()
      .filter((address) => address && address.family === "IPv4" && !address.internal)
      .map((address) => address!.address);
  } catch {
    return [];
  }
}

const production = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy: Lieferdank lädt keine fremden Skripte, bettet nichts
 * ein und schickt Formulare nur an sich selbst bzw. an Stripe Checkout.
 * 'unsafe-inline' für Skripte ist nötig, solange Next.js ohne Nonce rendert.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://connect.stripe.com",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.stripe.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Ohne diese Angabe sucht Turbopack die Projektwurzel über die nächste Lockdatei.
  turbopack: { root: path.resolve(process.cwd()) },
  allowedDevOrigins: production ? [] : lanAddresses(),
  experimental: {
    // Profilfotos werden im Browser auf < 1 MB verkleinert; 3 MB lassen Luft.
    serverActions: { bodySizeLimit: "3mb" },
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // www auf die Hauptdomain – eine kanonische Adresse für alles.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lieferdank.de" }],
        destination: "https://lieferdank.de/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

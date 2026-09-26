import path from "node:path";
import type { NextConfig } from "next";

/**
 * Sicherheits-Header. Bewusst konservativ: Lieferdank lädt keine fremden
 * Skripte und bettet nichts ein.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS greift nur über HTTPS; lokal bleibt es wirkungslos.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // Ohne diese Angabe sucht Turbopack die Projektwurzel anhand der naechsten
  // Lockdatei und landet ggf. im Home-Verzeichnis.
  turbopack: { root: path.resolve(process.cwd()) },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  async redirects() {
    return [
      // www auf die Hauptdomain umleiten – eine kanonische Adresse für alles.
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

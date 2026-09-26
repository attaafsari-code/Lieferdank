import type { Metadata, Viewport } from "next";
import { canonicalBase } from "@/server/site";
import { SPLASH_SIZES } from "@/lib/pwa/mark";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

const description =
  "Lieferdank gibt Paketzustellern, Essenslieferanten und Kurieren einen persönlichen Danke-Code. Kunden sagen kostenlos Danke oder geben Trinkgeld – ohne App, ohne Konto.";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalBase()),
  title: { default: "Lieferdank – Dein Danke kommt an.", template: "%s · Lieferdank" },
  description,
  applicationName: "Lieferdank",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Lieferdank",
    url: "/",
    title: "Lieferdank – Dein Danke kommt an.",
    description: "Sag dem Menschen hinter der Lieferung Danke. Kostenlos, ohne App, in wenigen Sekunden.",
  },
  twitter: { card: "summary_large_image", title: "Lieferdank – Dein Danke kommt an.", description },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Lieferdank",
    statusBarStyle: "default",
    startupImage: SPLASH_SIZES.map((s) => ({
      url: `/pwa/splash/${s.w}x${s.h}`,
      media: `(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1a5ce0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Die Latin-Datei deckt fast jeden Text ab und soll sofort da sein. */}
        <link rel="preload" href="/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

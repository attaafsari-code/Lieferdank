import { ImageResponse } from "next/og";
import { PwaMark } from "@/lib/pwa/mark";

/** Öffentliches, festes Checkout-Logo; dieselbe Bild- und Wortmarke wie Web/PWA/OG. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", gap: 28 }}>
        <div style={{ width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 32, background: "#1a5ce0" }}>
          <PwaMark size={120} />
        </div>
        <div style={{ display: "flex", fontSize: 100, fontWeight: 800, letterSpacing: -3 }}>
          <span style={{ color: "#0b2545" }}>Liefer</span>
          <span style={{ color: "#ff4d4a", marginLeft: -15 }}>dank</span>
        </div>
      </div>
    ),
    { width: 1024, height: 256, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}

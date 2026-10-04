import { ImageResponse } from "next/og";
import { PwaMark } from "@/lib/pwa/mark";

export const alt = "Lieferdank – Dein Danke kommt an.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vorschaubild für geteilte Links (WhatsApp, iMessage, soziale Netzwerke). Nur feste Inhalte. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 190,
            height: 190,
            borderRadius: 44,
            background: "#1a5ce0",
          }}
        >
          <PwaMark size={140} />
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 104, fontWeight: 800 }}>
          <span style={{ color: "#0b2545" }}>Liefer</span>
          {/* Der Renderer setzt zwischen zwei Textblöcke eine Lücke; ohne Ausgleich liest man „Liefer dank“. */}
          <span style={{ color: "#ff4d4a", marginLeft: -16 }}>dank</span>
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 44, color: "#475569" }}>Dein Danke kommt an.</div>
      </div>
    ),
    size,
  );
}

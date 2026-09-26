import { ImageResponse } from "next/og";
import { PwaMark, SPLASH_SIZES } from "@/lib/pwa/mark";

/** iOS-Startbildschirm, wenn Lieferdank vom Home-Screen geöffnet wird. */
export function generateStaticParams() {
  return SPLASH_SIZES.map((s) => ({ size: `${s.w}x${s.h}` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const match = (await params).size.match(/^(\d+)x(\d+)$/);
  const spec = match && SPLASH_SIZES.find((s) => s.w === Number(match[1]) && s.h === Number(match[2]));
  if (!spec) return new Response("Nicht gefunden", { status: 404 });

  const unit = spec.w / 10;
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
            width: unit * 2.6,
            height: unit * 2.6,
            borderRadius: unit * 0.6,
            background: "#1a5ce0",
          }}
        >
          <PwaMark size={Math.round(unit * 1.9)} />
        </div>
        <div style={{ display: "flex", marginTop: unit * 0.6, fontSize: unit * 0.62, fontWeight: 800, letterSpacing: -2 }}>
          <span style={{ color: "#0b2545" }}>Liefer</span>
          <span style={{ color: "#ff4d4a" }}>dank</span>
        </div>
      </div>
    ),
    { width: spec.w, height: spec.h },
  );
}

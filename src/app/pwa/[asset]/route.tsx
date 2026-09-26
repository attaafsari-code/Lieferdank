import { ImageResponse } from "next/og";
import { PwaMark } from "@/lib/pwa/mark";

/**
 * App-Icons für Manifest und Home-Screen, zur Buildzeit gerendert.
 *  icon-192.png, icon-512.png   – Standard (abgerundet)
 *  maskable-512.png             – Android „adaptive“, mit Sicherheitsrand
 */
const ASSETS: Record<string, { size: number; maskable: boolean }> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ASSETS).map((asset) => ({ asset }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const config = ASSETS[(await params).asset];
  if (!config) return new Response("Nicht gefunden", { status: 404 });
  const { size, maskable } = config;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a5ce0",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        {/* Maskable Icons brauchen 20 % Sicherheitsrand, weil Android sie beschneidet. */}
        <PwaMark size={Math.round(size * (maskable ? 0.58 : 0.74))} />
      </div>
    ),
    { width: size, height: size },
  );
}

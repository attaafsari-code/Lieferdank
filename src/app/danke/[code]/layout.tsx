import { DemoBanner } from "@/components/demo-banner";

/**
 * Ablenkungsfreies Layout für den QR-Zielscreen.
 * Keine Navigation, kein Menü – nur die Entscheidung des Kunden.
 */
export default function ThankYouLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <DemoBanner />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

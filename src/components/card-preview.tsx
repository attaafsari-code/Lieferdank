"use client";

import { renderCardSvg, type CardRenderInput } from "@/lib/card/svg";

/**
 * Zeigt eine Karte als Inline-SVG. Dieselbe Renderfunktion erzeugt auch
 * Downloads und Druck – die Vorschau ist also exakt das Ergebnis.
 */
export function CardPreview({ className = "", ...input }: CardRenderInput & { className?: string }) {
  const svg = renderCardSvg(input);
  return (
    <div
      className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

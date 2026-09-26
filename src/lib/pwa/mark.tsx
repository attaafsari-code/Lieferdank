/** Bildmarke für generierte App-Icons und Splashscreens (next/og, nur Inline-Styles). */
export function PwaMark({ size, color = "#ffffff" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <g stroke={color} strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round">
        <line x1="9" y1="21" x2="17" y2="21" />
        <line x1="7" y1="31" x2="15" y2="31" />
        <line x1="9" y1="41" x2="17" y2="41" />
      </g>
      <path d="M24 22.5 35 17l11 5.5v14L35 42l-11-5.5z" fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" />
      <path d="M24 22.5 35 28l11-5.5M35 28v14" fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="3" strokeLinejoin="round" />
      <path
        d="M38.4 40.6c0-2.4 1.9-4 3.9-4 1.2 0 2.2.6 2.8 1.4.6-.8 1.7-1.4 2.9-1.4 2 0 3.9 1.6 3.9 4 0 3.5-4.8 6.6-6.8 7.8-2-1.2-6.7-4.3-6.7-7.8z"
        fill="#ff4d4a"
        stroke="#1a5ce0"
        strokeWidth="3"
      />
    </svg>
  );
}

/** iPhone-Größen (Portrait, physische Pixel) für apple-touch-startup-image. */
export const SPLASH_SIZES = [
  { w: 1320, h: 2868, dw: 440, dh: 956, ratio: 3 },
  { w: 1206, h: 2622, dw: 402, dh: 874, ratio: 3 },
  { w: 1290, h: 2796, dw: 430, dh: 932, ratio: 3 },
  { w: 1179, h: 2556, dw: 393, dh: 852, ratio: 3 },
  { w: 1284, h: 2778, dw: 428, dh: 926, ratio: 3 },
  { w: 1170, h: 2532, dw: 390, dh: 844, ratio: 3 },
  { w: 1125, h: 2436, dw: 375, dh: 812, ratio: 3 },
  { w: 750, h: 1334, dw: 375, dh: 667, ratio: 2 },
];

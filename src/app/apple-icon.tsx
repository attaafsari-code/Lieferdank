import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-Screen-Icon für iOS. Bewusst ohne Text – nur die Bildmarke. */
export default function AppleIcon() {
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
        }}
      >
        <svg width="132" height="132" viewBox="0 0 64 64">
          <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round">
            <line x1="9" y1="21" x2="17" y2="21" />
            <line x1="7" y1="31" x2="15" y2="31" />
            <line x1="9" y1="41" x2="17" y2="41" />
          </g>
          <path
            d="M24 22.5 35 17l11 5.5v14L35 42l-11-5.5z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M24 22.5 35 28l11-5.5M35 28v14"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M38.4 40.6c0-2.4 1.9-4 3.9-4 1.2 0 2.2.6 2.8 1.4.6-.8 1.7-1.4 2.9-1.4 2 0 3.9 1.6 3.9 4 0 3.5-4.8 6.6-6.8 7.8-2-1.2-6.7-4.3-6.7-7.8z"
            fill="#ff4d4a"
            stroke="#1a5ce0"
            strokeWidth="3"
          />
        </svg>
      </div>
    ),
    size,
  );
}

import QRCode from "qrcode";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { cardColorSelection, type CardColor, type CardLayout } from "@/lib/card/design";
import { renderCardSvg } from "@/lib/card/svg";
import { CardDesigner } from "@/app/dashboard/karte/card-designer";

vi.mock("@/server/actions/driver", () => ({ saveCardDesignAction: vi.fn() }));

const cases: [CardLayout, CardColor, string, string][] = [
  ["classic", "blue", "Weiß", "#ffffff"],
  ["classic", "navy", "Hellblaugrau", "#f0f4f8"],
  ["classic", "teal", "Hellpetrol", "#effaf6"],
  ["personal", "blue", "Weiß", "#ffffff"],
  ["personal", "navy", "Hellblaugrau", "#f0f4f8"],
  ["personal", "teal", "Hellpetrol", "#effaf6"],
  ["brand", "blue", "Blau", "#1a5ce0"],
  ["brand", "navy", "Nachtblau", "#173653"],
  ["brand", "teal", "Petrol", "#0c6963"],
];

it.each(cases)("%s / %s: the named swatch matches the actual exported background", async (layout, color, label, background) => {
  const selection = cardColorSelection(layout);
  expect(selection.label).toBe("Hintergrundfarbe");
  expect(selection.options.find(option => option.id === color)).toEqual({ id: color, label, background });

  const qrSvg = await QRCode.toString("https://lieferdank.de/danke/LD-TESTCOLOR", { type: "svg", margin: 0 });
  const svg = renderCardSvg({ layout, color, headline: "Danke ❤", publicName: "Max", providerLabel: null, code: "LD-TESTCOLOR", qrSvg, avatar: null });
  const { data, info } = await sharp(Buffer.from(svg)).resize(856, 540).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // A real background pixel, away from the rounded edge, QR, logo and text.
  const offset = (20 * info.width + 400) * info.channels;
  expect(`#${data.subarray(offset, offset + 3).toString("hex")}`).toBe(background);
  expect(svg).toContain('fill="#ff4d4a">❤</tspan>');
  expect(svg).toContain(`fill="${layout === "brand" ? "#ffffff" : "#0d1b2f"}">Max</text>`);

  const html = renderToStaticMarkup(createElement(CardDesigner, {
    initial: { layout, color, headline: "Danke ❤", showPhoto: false, showProvider: false, updatedAt: "2026-10-16T00:00:00.000Z" },
    qrSvg, publicName: "Max", initials: "M", photoUrl: null, code: "LD-TESTCOLOR",
  }));
  const controls = html.match(/<fieldset aria-describedby="card-color-hint">([\s\S]*?)<\/fieldset>/)?.[1];
  expect(controls).toBeDefined();
  expect(controls).toContain("Hintergrundfarbe");
  expect(controls).toContain(`background-color:${background}`);
  expect(controls).toContain(`</span>${label}</button>`);
});

it("explains light versus full-color backgrounds without changing stored color identities", () => {
  for (const layout of ["classic", "personal"] as const) {
    expect(cardColorSelection(layout).hint).toContain("helle");
    expect(cardColorSelection(layout).hint).toContain("Farbfläche");
  }
  expect(cardColorSelection("brand").hint).toContain("Kräftige");
  expect(cardColorSelection("classic").options.map(option => option.id)).toEqual(["blue", "navy", "teal"]);
  expect(cardColorSelection("personal")).toEqual(cardColorSelection("classic"));
});

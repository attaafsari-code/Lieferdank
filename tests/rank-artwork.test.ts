import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { expect, it } from "vitest";
import { RANKS, rankBadgeSvg } from "@/lib/ranks";
import { CARD_COLORS, RANK_CARD_COLORS, CARD_LAYOUTS } from "@/lib/card/design";
import { renderCardSvg } from "@/lib/card/svg";

it.each(RANKS)("%s: readable QR, safe badges and all 30 layout/colors in exports", async rank => {
  const qrSvg = await QRCode.toString("https://lieferdank.de/danke/LD-TESTBADGE", { type: "svg", margin: 0 });
  const badge = rankBadgeSvg(rank.id);
  expect(badge).toContain(`fill="${rank.color}"`);expect(badge).not.toMatch(/<script|<image|https:|currentColor|filter=|mix-blend/);
  for (const layout of CARD_LAYOUTS) for (const color of [...CARD_COLORS,...RANK_CARD_COLORS]) {
    const svg = renderCardSvg({ layout: layout.id, color: color.id, rank: rank.id, headline: "Danke ❤", publicName: "Max", providerLabel: null, code: "LD-TESTBADGE", qrSvg, avatar: { href: null, initials: "M" } });
    const {data,info}=await sharp(Buffer.from(svg)).resize(1027,648).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    expect(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data).toBe("https://lieferdank.de/danke/LD-TESTBADGE");
    expect(svg.match(/<svg\b/g)).toHaveLength(1);expect(svg).toContain(`>${rank.label}</text>`);
    expect(svg).toContain('fill="#ff4d4a">❤</tspan>');
  }
});
it("keeps Diamond text dark on bright ice blue and adds Legend's gold without recoloring the heart", () => {
  const make=(color:"diamond"|"legend")=>renderCardSvg({layout:"brand",color,rank:color,headline:"Danke ❤",publicName:"Max",providerLabel:null,code:"LD-TESTBADGE",qrSvg:'<svg viewBox="0 0 1 1"></svg>',avatar:null});
  expect(make("diamond")).toContain('fill="#00AEEF"');expect(make("diamond")).toContain('fill="#0d1b2f">Max</text>');
  expect(make("legend")).toContain('fill="#592A9C"');expect(make("legend")).toContain('stroke="#F4C76A"');expect(make("legend")).toContain('fill="#ff4d4a">❤</tspan>');
});

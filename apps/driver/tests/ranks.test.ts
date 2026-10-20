import { expect, it } from "vitest";
import { RANKS, rankProgress, rankBadgeSvg } from "../../../src/lib/ranks";
import { editorSvg, type CardEditorData } from "../src/card-editor";
import { cardBackgroundColor, rankColorOptions, CARD_LAYOUTS, CARD_COLORS, RANK_CARD_COLORS } from "../../../src/lib/card/design";
import { renderCardSvg } from "../../../src/lib/card/svg";
import { cardDocument } from "../src/card-document";
import { deepLink } from "../src/api";

it("uses the same server-derived rank for native preview and PDF without overwriting chosen colors", () => {
  for(const rank of RANKS) {
    const data: CardEditorData={design:{layout:"personal",color:"teal",headline:"Danke ❤",showPhoto:false,showProvider:false,showRankBadge:true,updatedAt:"2026-10-17T00:00:00.000Z"},context:{publicName:"Max",initials:"M",code:"LD-TESTBADGE",qrSvg:'<svg viewBox="0 0 1 1"></svg>',photoHref:null,rank:rankProgress(rank.threshold)}};
    const svg=editorSvg(data);expect(svg).toContain(`>${rank.label}</text>`);expect(svg).toContain('fill="#effaf6"');expect(cardDocument(svg)).toContain(svg);expect(rankBadgeSvg(rank.id)).not.toContain("emoji");
    for(const layout of ["classic","personal","brand"] as const)expect(rankColorOptions(layout)).toHaveLength(7);
  }
});
it("applies the native badge toggle to preview and PDF while preserving the selected color", () => {
  const data: CardEditorData = { design: { layout: "classic", color: "teal", headline: "Danke ❤", showPhoto: false, showProvider: false, showRankBadge: true, updatedAt: "2026-10-17T00:00:00.000Z" }, context: { publicName: "Max", initials: "M", code: "LD-TESTBADGE", qrSvg: '<svg viewBox="0 0 1 1"></svg>', photoHref: null, rank: rankProgress(50) } };
  for (const layout of CARD_LAYOUTS) {
    const visible = editorSvg(data, { ...data.design, layout: layout.id });
    const hidden = editorSvg(data, { ...data.design, layout: layout.id, showRankBadge: false });
    expect(visible).toContain(">Bronze</text>");
    expect(hidden).not.toContain(">Bronze</text>");
    expect(hidden).toContain(`fill="${cardBackgroundColor(layout.id, "teal")}"`);
    expect(cardDocument(hidden)).toContain(hidden);
  }
});
it("does not render a locked color as earned and allows the native milestone deep link",()=>{
  const data:CardEditorData={design:{layout:"brand",color:"legend",headline:"Danke",showPhoto:false,showProvider:false,showRankBadge:true,updatedAt:"2026-10-17T00:00:00.000Z"},context:{publicName:"Max",initials:"M",code:"LD-TESTBADGE",qrSvg:'<svg viewBox="0 0 1 1"></svg>',photoHref:null,rank:rankProgress(49)}};
  expect(editorSvg(data)).not.toContain('fill="#592A9C"');expect(editorSvg(data)).toContain('fill="#1a5ce0"');expect(data.design.color).toBe("legend");
  expect(deepLink("lieferdank://milestones")).toEqual({screen:"milestones"});
});
it("accepts all 240 approved rank/layout/color combinations in the native PDF document", () => {
  for (const rank of RANKS) for (const layout of CARD_LAYOUTS) for (const color of [...CARD_COLORS, ...RANK_CARD_COLORS]) {
    const svg = renderCardSvg({ layout: layout.id, color: color.id, rank: rank.id, headline: "Danke ❤", publicName: "Max", providerLabel: null, code: "LD-TESTBADGE", qrSvg: '<svg viewBox="0 0 1 1"></svg>', avatar: null });
    expect(cardDocument(svg)).toContain(svg);
  }
});

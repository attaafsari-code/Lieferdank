import { expect, it } from "vitest";
import { RANKS, rankProgress, rankBadgeSvg } from "../../../src/lib/ranks";
import { editorSvg, type CardEditorData } from "../src/card-editor";
import { rankColorOptions } from "../../../src/lib/card/design";
import { cardDocument } from "../src/card-document";
import { deepLink } from "../src/api";

it("uses the same server-derived rank for native preview and PDF without overwriting chosen colors", () => {
  for(const rank of RANKS) {
    const data: CardEditorData={design:{layout:"personal",color:"teal",headline:"Danke ❤",showPhoto:false,showProvider:false,updatedAt:"2026-10-17T00:00:00.000Z"},context:{publicName:"Max",initials:"M",code:"LD-TESTBADGE",qrSvg:'<svg viewBox="0 0 1 1"></svg>',photoHref:null,rank:rankProgress(rank.threshold)}};
    const svg=editorSvg(data);expect(svg).toContain(`>${rank.label}</text>`);expect(svg).toContain('fill="#effaf6"');expect(cardDocument(svg)).toContain(svg);expect(rankBadgeSvg(rank.id)).not.toContain("emoji");
    for(const layout of ["classic","personal","brand"] as const)expect(rankColorOptions(layout)).toHaveLength(7);
  }
});
it("does not render a locked color as earned and allows the native milestone deep link",()=>{
  const data:CardEditorData={design:{layout:"brand",color:"legend",headline:"Danke",showPhoto:false,showProvider:false,updatedAt:"2026-10-17T00:00:00.000Z"},context:{publicName:"Max",initials:"M",code:"LD-TESTBADGE",qrSvg:'<svg viewBox="0 0 1 1"></svg>',photoHref:null,rank:rankProgress(49)}};
  expect(editorSvg(data)).not.toContain('fill="#592A9C"');expect(editorSvg(data)).toContain('fill="#1a5ce0"');expect(data.design.color).toBe("legend");
  expect(deepLink("lieferdank://milestones")).toEqual({screen:"milestones"});
});

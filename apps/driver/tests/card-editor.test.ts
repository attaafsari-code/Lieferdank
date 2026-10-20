import { expect, it } from "vitest";
import { decodeSvgText, editorSvg, sameCard, type CardEditorData } from "../src/card-editor";
import { cardDocument } from "../src/card-document";
import { renderCardSvg } from "../../../src/lib/card/svg";
import { cardColorSelection, CARD_COLORS, CARD_LAYOUTS } from "../../../src/lib/card/design";

const data: CardEditorData = { design: { layout: "classic", color: "blue", headline: "Danke ❤", showPhoto: false, showProvider: false, showRankBadge: true, updatedAt: "2026-10-16T00:00:00.000Z" }, context: { publicName: "A < B", initials: "AB", code: "LD-TESTCARD", qrSvg: '<svg viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>', photoHref: "data:image/jpeg;base64,AQID" } };
it("uses the canonical web renderer for every layout and color, including photo and escaped text", () => {
  for (const layout of CARD_LAYOUTS) for (const color of CARD_COLORS) {
    const fields = { ...data.design, layout: layout.id, color: color.id, showPhoto: true };
    const svg = editorSvg(data, fields);
    expect(svg).toBe(renderCardSvg({ ...fields, publicName: data.context.publicName, providerLabel: null, code: data.context.code, qrSvg: data.context.qrSvg, avatar: { href: data.context.photoHref, initials: data.context.initials }, idPrefix: "native-editor" }));
    expect(cardDocument(svg)).toContain(svg); expect(svg).toContain("A &lt; B"); expect(svg).toContain("data:image/jpeg;base64,AQID");
    const selected = cardColorSelection(layout.id).options.find(option => option.id === color.id)!;
    expect(svg).toContain(`fill="${selected.background}"`);
  }
});
it("detects unsaved design changes but ignores server revision metadata", () => {
  expect(sameCard(data.design, { ...data.design, color: undefined })).toBe(true);
  for (const patch of [{ layout: "personal" as const }, { color: "teal" as const }, { headline: "Anders" }, { showPhoto: true }, { showRankBadge: false }]) expect(sameCard(data.design, { ...data.design, ...patch })).toBe(false);
});
it("does not show or export a private photo when the card photo toggle is off", () => {
  expect(editorSvg(data)).not.toContain("data:image");
  expect(editorSvg(data, { ...data.design, layout: "personal" })).toContain(">AB</text>");
  expect(editorSvg(data, { ...data.design, layout: "personal" })).not.toContain("data:image");
});
it("decodes text only once in the parsed tree, without turning escaped user input into markup", () => {
  type Node = { children: (Node | string)[] };
  const tree: Node = { children: ["QR SCANNEN &amp; DANKE SAGEN", { children: ["&lt;script&gt; &amp;lt; &quot;x&quot; &apos;y&apos;"] }] };
  expect(decodeSvgText(tree)).toEqual({ children: ["QR SCANNEN & DANKE SAGEN", { children: ['<script> &lt; "x" \'y\''] }] });
});

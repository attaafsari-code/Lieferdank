import { renderCardSvg } from "../../../src/lib/card/svg";
import type { CardDesignFields } from "../../../src/lib/card/design";
import { isRankColor, type RankProgress } from "../../../src/lib/ranks";

export type CardEditorData = {
  design: CardDesignFields & { updatedAt: string };
  context: { publicName: string; initials: string; code: string; qrSvg: string; photoHref: string | null; rank?: RankProgress };
};

/** The same pure renderer used by the website, print page and API. No native template copy. */
export function editorSvg(data: CardEditorData, fields: CardDesignFields = data.design): string {
  const { context } = data;
  const color = isRankColor(fields.color) && !context.rank?.unlockedColors.includes(fields.color) ? "blue" : fields.color;
  return renderCardSvg({ ...fields, color, rank: context.rank?.current?.id, publicName: context.publicName, providerLabel: null, code: context.code,
    qrSvg: context.qrSvg, avatar: fields.showPhoto || fields.layout === "personal"
      ? { href: fields.showPhoto ? context.photoHref : null, initials: context.initials } : null, idPrefix: "native-editor" });
}

export function sameCard(a: CardDesignFields, b: CardDesignFields) {
  return a.layout === b.layout && (a.color ?? "blue") === (b.color ?? "blue") && a.headline === b.headline && a.showPhoto === b.showPhoto && a.showProvider === b.showProvider && a.showRankBadge === b.showRankBadge;
}

/** Decode once AFTER XML parsing. Never unescape markup before it is parsed. */
export function decodeSvgText<T extends { children: (T | string)[] }>(node: T): T {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  node.children = node.children.map(child => typeof child === "string"
    ? child.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => entities[name]) : decodeSvgText(child));
  return node;
}

import { CARD_LAYOUTS, rankColorOptions, type CardColor } from "@/lib/card/design";
import { RANKS } from "@/lib/ranks";

export type PreviewQuery = { rang?: string; layout?: string; farbe?: string; abzeichen?: string };

/** Selection is limited to the fixed design catalogue and never reads driver data. */
export function previewSelection(query: PreviewQuery) {
  const rank = RANKS.find(item => item.id === query.rang) ?? RANKS[0];
  const layout = CARD_LAYOUTS.find(item => item.id === query.layout)?.id ?? CARD_LAYOUTS[0].id;
  const unlockedColors = rankColorOptions(layout).filter(item => rank.threshold >= item.requiredThanks);
  const color = unlockedColors.find(item => item.id === query.farbe)?.id ?? "blue";
  return { rank, layout, color: color as CardColor, showBadge: query.abzeichen !== "aus", unlockedColors };
}

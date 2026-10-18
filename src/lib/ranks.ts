/** Shared, pure contract. Eligibility always comes from server-counted valid thank-yous. */
export const RANKS = [
  { id: "start", label: "Start", threshold: 1, color: "#1a5ce0", accent: "#ff4d4a", light: "#edf4ff", cardSolid: "#1a5ce0", reward: false },
  { id: "bronze", label: "Bronze", threshold: 50, color: "#A8683B", accent: "#E9C4A5", light: "#fbf3ed", cardSolid: "#875432", reward: false },
  { id: "copper", label: "Kupfer", threshold: 100, color: "#B56A4D", accent: "#F0C3AE", light: "#fcf0eb", cardSolid: "#914D35", reward: false },
  { id: "silver", label: "Silber", threshold: 500, color: "#8293A6", accent: "#E6EEF7", light: "#f1f4f8", cardSolid: "#526376", reward: true },
  { id: "gold", label: "Gold", threshold: 1000, color: "#B88718", accent: "#F4D987", light: "#fff8e8", cardSolid: "#805D13", reward: true },
  { id: "platinum", label: "Platin", threshold: 2000, color: "#536E76", accent: "#D7EFF2", light: "#eef6f7", cardSolid: "#355B66", reward: true },
  { id: "diamond", label: "Diamant", threshold: 5000, color: "#00AEEF", accent: "#DDF6FF", light: "#edfaff", cardSolid: "#00AEEF", reward: true },
  { id: "legend", label: "Legende", threshold: 10000, color: "#592A9C", accent: "#F4C76A", light: "#f5effc", cardSolid: "#592A9C", reward: true },
] as const;

export type RankTier = typeof RANKS[number];
export type RankId = RankTier["id"];
export type RankColor = Exclude<RankId, "start">;
export const REWARD_THRESHOLDS = [500, 1000, 2000, 5000, 10000] as const;
export const REWARD_PREVIEW = "Vorschau: Inhalte und Bedingungen sind noch nicht festgelegt. Rewards sind derzeit nicht beanspruchbar.";
export const RANK_EXPLANATION = "LieferDank-Ränge zeigen erhaltene, gültige Danke. Danke zu vollständig erstatteten oder strittigen Zahlungen zählen nicht zum Rang. Ränge sind keine berufliche Qualifikation oder unabhängig geprüfte Leistungsbewertung.";

export function rankTier(id: unknown): RankTier | null { return RANKS.find(rank => rank.id === id) ?? null; }
export function isRankColor(id: unknown): id is RankColor { return id !== "start" && rankTier(id) !== null; }
export function rankProgress(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Ungültige Danke-Anzahl");
  const reached = RANKS.filter(rank => count >= rank.threshold);
  const current = reached.at(-1) ?? null;
  const next = RANKS.find(rank => count < rank.threshold) ?? null;
  const target = next?.threshold ?? 10000;
  return { count, current, next, target, remaining: Math.max(0, target - count), percent: Math.min(100, Math.floor(count * 100 / target)),
    maximum: next === null, reached: reached.map(rank => rank.id), unlockedColors: reached.filter(rank => rank.id !== "start").map(rank => rank.id as RankColor), rewardsPreview: true as const };
}
export type RankProgress = ReturnType<typeof rankProgress>;

/** Fixed vector artwork, no user-supplied SVG or emoji. Usable inside the card's single root SVG. */
export function rankBadgeMarkup(id: RankId, x = 0, y = 0, width = 48): string {
  const rank = rankTier(id); if (!rank) return "";
  const legend = id === "legend";
  const symbol = legend
    ? '<path d="M12 23l5 5 7-12 7 12 5-5-3 16H15z" fill="#F4C76A"/><path d="M16 42h16" stroke="#F4C76A" stroke-width="2"/>'
    : id === "diamond"
      ? '<path d="M13 24l6-7h10l6 7-11 19zM13 24h22M19 17l5 26 5-26" fill="#DDF6FF" stroke="#0b2545" stroke-width="1.4" stroke-linejoin="round"/>'
      : '<path d="M24 17l3.5 7.3 8 1.2-5.8 5.6 1.4 8-7.1-3.8-7.1 3.8 1.4-8-5.8-5.6 8-1.2z" fill="white" fill-opacity="0.94"/>';
  return `<g transform="translate(${x} ${y}) scale(${width / 48})"><path d="M24 4L44 12v17c0 12-12 23-20 27C16 52 4 41 4 29V12z" fill="${rank.color}" stroke="${rank.accent}" stroke-width="2.5"/><path d="M24 9l15 7v13c0 9-8 18-15 22-7-4-15-13-15-22V16z" fill="none" stroke="${rank.accent}" stroke-opacity="0.6" stroke-width="1"/>${symbol}${legend ? '<path d="M7 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1zm34 0l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#F4C76A"/>' : ""}</g>`;
}
export function rankBadgeSvg(id: RankId): string {
  const rank = rankTier(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 60" role="img" aria-label="${rank?.label ?? ""} – LieferDank-Rang">${rankBadgeMarkup(id)}</svg>`;
}

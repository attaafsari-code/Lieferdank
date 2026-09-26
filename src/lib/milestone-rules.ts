/**
 * Meilensteine. Bewusst nur positiv und ohne Vergleich zwischen Zustellern:
 * keine Ranglisten, kein Wettbewerb.
 */

export type MilestoneProgress = {
  thankYouCount: number;
  streakDays: number;
  tipCount: number;
  receivedCents: number;
};

export type MilestoneKey = { type: string; value: number };

const THANK_YOU_STEPS = [1, 10, 50, 100, 500, 1000];
const STREAK_STEPS = [5];
const RECEIVED_STEPS_CENTS = [10_000];

export function reachedMilestones(progress: MilestoneProgress): MilestoneKey[] {
  const reached: MilestoneKey[] = [];
  for (const step of THANK_YOU_STEPS) {
    if (progress.thankYouCount >= step) reached.push({ type: "thank_you_count", value: step });
  }
  for (const step of STREAK_STEPS) {
    if (progress.streakDays >= step) reached.push({ type: "streak_days", value: step });
  }
  if (progress.tipCount >= 1) reached.push({ type: "first_tip", value: 1 });
  for (const step of RECEIVED_STEPS_CENTS) {
    if (progress.receivedCents >= step) reached.push({ type: "received_cents", value: step });
  }
  return reached;
}

export function describeMilestone(type: string, value: number): { emoji: string; title: string } {
  switch (type) {
    case "thank_you_count":
      return value === 1
        ? { emoji: "❤️", title: "Dein erstes Danke" }
        : { emoji: "🎉", title: `${value.toLocaleString("de-DE")}× Danke erhalten` };
    case "streak_days":
      return { emoji: "🔥", title: `${value} Tage hintereinander ein Danke` };
    case "first_tip":
      return { emoji: "💶", title: "Dein erstes Trinkgeld" };
    case "received_cents":
      return { emoji: "🏆", title: `${(value / 100).toLocaleString("de-DE")} € erhalten` };
    default:
      return { emoji: "⭐", title: "Meilenstein erreicht" };
  }
}

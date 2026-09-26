import "server-only";
import { getStore } from "./db";
import { newId } from "./id";

/**
 * Meilensteine (§16). Bewusst nur positiv, ohne Vergleich zwischen Zustellern.
 * Keine Ranglisten, kein Wettbewerb.
 */

const THANK_YOU_STEPS = [1, 10, 25, 50, 100, 250, 500, 1000];
const STREAK_STEPS = [3, 5, 7, 14, 30];

export type MilestoneView = { emoji: string; title: string; achievedAt: string };

export function describeMilestone(type: string, value: number): { emoji: string; title: string } {
  if (type === "thank_you_count") {
    if (value === 1) return { emoji: "❤️", title: "Dein erstes Danke" };
    return { emoji: "\u{1F389}", title: `${value}× Danke erhalten` };
  }
  if (type === "streak_days") {
    return { emoji: "\u{1F525}", title: `${value} Tage hintereinander ein Danke` };
  }
  return { emoji: "⭐", title: `Meilenstein: ${value}` };
}

/**
 * Prueft nach jedem Danke, ob neue Meilensteine erreicht wurden.
 * Idempotent: bereits vergebene Meilensteine werden nicht doppelt angelegt.
 */
export async function awardMilestones(
  driverId: string,
  thankYouCount: number,
  streakDays: number,
): Promise<void> {
  const store = getStore();
  const existing = await store.listMilestonesByDriver(driverId);
  const has = (type: string, value: number) =>
    existing.some((m) => m.type === type && m.value === value);

  const now = new Date().toISOString();
  const pending: { type: string; value: number }[] = [];

  for (const step of THANK_YOU_STEPS) {
    if (thankYouCount >= step && !has("thank_you_count", step)) {
      pending.push({ type: "thank_you_count", value: step });
    }
  }
  for (const step of STREAK_STEPS) {
    if (streakDays >= step && !has("streak_days", step)) {
      pending.push({ type: "streak_days", value: step });
    }
  }

  for (const m of pending) {
    await store.createMilestone({
      id: newId(),
      driverId,
      type: m.type,
      value: m.value,
      achievedAt: now,
    });
  }
}

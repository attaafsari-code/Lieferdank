import "server-only";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { reachedMilestones } from "@/lib/milestone-rules";
import { computeStreak } from "./stats";

/** Vergibt neu erreichte Meilensteine. Idempotent. */
export async function refreshMilestones(driverId: string): Promise<void> {
  const db = getDb();
  const [thankYous, tips, existing] = await Promise.all([
    db.thankYous.findMany({ where: { driverId } }),
    db.tips.findMany({ where: { driverId, paymentStatus: "succeeded" } }),
    db.milestones.findMany({ where: { driverId } }),
  ]);

  const reached = reachedMilestones({
    thankYouCount: thankYous.length,
    streakDays: computeStreak(thankYous.map((t) => t.createdAt)),
    tipCount: tips.length,
    receivedCents: tips.reduce((sum, tip) => sum + tip.driverCents, 0),
  });

  const has = new Set(existing.map((m) => `${m.type}:${m.value}`));
  const now = new Date().toISOString();
  for (const milestone of reached) {
    if (has.has(`${milestone.type}:${milestone.value}`)) continue;
    await db.milestones.insert({ id: newId(), driverId, ...milestone, achievedAt: now });
  }
}

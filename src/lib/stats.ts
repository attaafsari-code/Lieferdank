import "server-only";
import { getStore } from "./db";
import type { Milestone, ThankYou, Tip } from "./db/types";
import { currentWeekKeys, dayKey, previousDayKey, startOfTodayIso } from "./time";

export type Period = { thanks: number; tipCount: number; driverCents: number };

export type DriverStats = {
  today: Period;
  week: Period;
  total: Period;
  /** Guthaben: bestaetigt, aber noch nicht ausgezahlt (§78). */
  balanceCents: number;
  paidOutCents: number;
  streakDays: number;
  recentThankYous: ThankYou[];
  recentTips: Tip[];
  milestones: Milestone[];
};

const succeeded = (t: Tip) => t.paymentStatus === "succeeded";

function summarize(tips: Tip[], thankYous: ThankYou[]): Period {
  return {
    thanks: thankYous.length,
    tipCount: tips.length,
    driverCents: tips.reduce((sum, t) => sum + t.driverCents, 0),
  };
}

/**
 * Zaehlt aufeinanderfolgende Tage mit mindestens einem Danke (§16).
 * Bricht ab, sobald ein Tag ohne Danke gefunden wird.
 */
function computeStreak(thankYous: ThankYou[]): number {
  const days = new Set(thankYous.map((t) => dayKey(t.createdAt)));
  let key = dayKey();
  if (!days.has(key)) {
    // Heute noch kein Danke: die Serie darf trotzdem bis gestern zaehlen.
    key = previousDayKey(key);
    if (!days.has(key)) return 0;
  }
  let streak = 0;
  while (days.has(key)) {
    streak += 1;
    key = previousDayKey(key);
  }
  return streak;
}

export async function getDriverStats(driverId: string): Promise<DriverStats> {
  const store = getStore();
  const [allTips, allThankYous, milestones] = await Promise.all([
    store.listTipsByDriver(driverId),
    store.listThankYousByDriver(driverId),
    store.listMilestonesByDriver(driverId),
  ]);

  const tips = allTips.filter(succeeded);
  const today = dayKey();
  const weekKeys = new Set(currentWeekKeys());

  const todayTips = tips.filter((t) => dayKey(t.createdAt) === today);
  const todayThanks = allThankYous.filter((t) => dayKey(t.createdAt) === today);
  const weekTips = tips.filter((t) => weekKeys.has(dayKey(t.createdAt)));
  const weekThanks = allThankYous.filter((t) => weekKeys.has(dayKey(t.createdAt)));

  const balanceCents = tips
    .filter((t) => t.payoutStatus !== "paid_out")
    .reduce((sum, t) => sum + t.driverCents, 0);
  const paidOutCents = tips
    .filter((t) => t.payoutStatus === "paid_out")
    .reduce((sum, t) => sum + t.driverCents, 0);

  const byNewest = <T extends { createdAt: string }>(list: T[]) =>
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    today: summarize(todayTips, todayThanks),
    week: summarize(weekTips, weekThanks),
    total: summarize(tips, allThankYous),
    balanceCents,
    paidOutCents,
    streakDays: computeStreak(allThankYous),
    recentThankYous: byNewest(allThankYous).slice(0, 20),
    recentTips: byNewest(tips).slice(0, 20),
    milestones: [...milestones].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)),
  };
}

export type PlatformStats = {
  grossTipVolumeCents: number;
  tipCount: number;
  averageTipCents: number;
  grossPlatformFeeCents: number;
  paymentFeeCents: number;
  netRevenueCents: number;
  revenuePerTransactionCents: number;
  freeThankYouCount: number;
  scanCount: number;
  scanToPaymentRate: number;
  scanToThankYouRate: number;
  activeDrivers: number;
  totalDrivers: number;
  pendingVerifications: number;
};

export async function getPlatformStats(scope: "today" | "all" = "all"): Promise<PlatformStats> {
  const store = getStore();
  const [tips, thankYous, drivers, verifications, scans] = await Promise.all([
    store.listTips(),
    store.listThankYous(),
    store.listDrivers(),
    store.listVerifications(),
    store.countScans(scope === "today" ? { sinceIso: startOfTodayIso() } : undefined),
  ]);

  const today = dayKey();
  const inScope = <T extends { createdAt: string }>(list: T[]) =>
    scope === "all" ? list : list.filter((x) => dayKey(x.createdAt) === today);

  const paid = inScope(tips).filter(succeeded);
  const thanks = inScope(thankYous);

  const grossTipVolumeCents = paid.reduce((s, t) => s + t.grossCents, 0);
  const grossPlatformFeeCents = paid.reduce((s, t) => s + t.platformGrossFeeCents, 0);
  const paymentFeeCents = paid.reduce((s, t) => s + t.paymentProviderFeeCents, 0);
  const netRevenueCents = grossPlatformFeeCents - paymentFeeCents;
  const activeDriverIds = new Set(paid.map((t) => t.driverId));

  return {
    grossTipVolumeCents,
    tipCount: paid.length,
    averageTipCents: paid.length ? Math.round(grossTipVolumeCents / paid.length) : 0,
    grossPlatformFeeCents,
    paymentFeeCents,
    netRevenueCents,
    revenuePerTransactionCents: paid.length ? Math.round(netRevenueCents / paid.length) : 0,
    freeThankYouCount: thanks.filter((t) => !t.tipId).length,
    scanCount: scans,
    scanToPaymentRate: scans ? paid.length / scans : 0,
    scanToThankYouRate: scans ? thanks.length / scans : 0,
    activeDrivers: activeDriverIds.size,
    totalDrivers: drivers.length,
    pendingVerifications: verifications.filter(
      (v) => v.identityStatus === "pending" || v.driverStatus === "pending",
    ).length,
  };
}

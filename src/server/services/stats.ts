import "server-only";
import { getDb } from "@/lib/db";
import type { Milestone, ThankYou, Tip } from "@/lib/db/types";
import { currentWeekKeys, dayKey, monthKey, previousDayKey, startOfTodayIso } from "@/lib/time";

export type Period = { thanks: number; tipCount: number; driverCents: number };

export type DriverStats = {
  today: Period;
  week: Period;
  month: Period;
  total: Period;
  /** Nur kostenlose Danksagungen, ohne die mit Trinkgeld verbundenen Danke. */
  freeThankYouTotal: number;
  /** Anteil nach Application Fee, vor Stripe-Kosten. Kein auszahlbares Guthaben. */
  driverShareBeforeStripeCents: number;
  inReviewCents: number;
  streakDays: number;
  recentThankYous: ThankYou[];
  recentTips: Tip[];
  milestones: Milestone[];
};

const succeeded = (tip: Tip) => tip.paymentStatus === "succeeded";
const newestFirst = <T extends { createdAt: string }>(list: T[]) =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

function summarize(tips: Tip[], thankYous: ThankYou[]): Period {
  return {
    thanks: thankYous.length,
    tipCount: tips.length,
    driverCents: tips.reduce((sum, tip) => sum + tip.driverCents, 0),
  };
}

/** Aufeinanderfolgende Tage mit mindestens einem Danke. Heute ohne Danke bricht die Serie nicht. */
export function computeStreak(thankYouDates: string[], now = new Date()): number {
  const days = new Set(thankYouDates.map((date) => dayKey(date)));
  let key = dayKey(now);
  if (!days.has(key)) {
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
  const db = getDb();
  const [allTips, thankYous, milestones] = await Promise.all([
    db.tips.findMany({ where: { driverId } }),
    db.thankYous.findMany({ where: { driverId } }),
    db.milestones.findMany({ where: { driverId }, orderBy: "achievedAt", desc: true }),
  ]);

  const tips = allTips.filter(succeeded);
  const today = dayKey();
  const month = monthKey();
  const week = new Set(currentWeekKeys());

  const inDay = <T extends { createdAt: string }>(list: T[]) => list.filter((x) => dayKey(x.createdAt) === today);
  const inWeek = <T extends { createdAt: string }>(list: T[]) => list.filter((x) => week.has(dayKey(x.createdAt)));
  const inMonth = <T extends { createdAt: string }>(list: T[]) => list.filter((x) => monthKey(x.createdAt) === month);

  return {
    today: summarize(inDay(tips), inDay(thankYous)),
    week: summarize(inWeek(tips), inWeek(thankYous)),
    month: summarize(inMonth(tips), inMonth(thankYous)),
    total: summarize(tips, thankYous),
    freeThankYouTotal: thankYous.filter((thankYou) => !thankYou.tipId).length,
    driverShareBeforeStripeCents: tips.reduce((s, t) => s + t.driverCents, 0),
    inReviewCents: allTips.filter((t) => t.paymentStatus === "review_required").reduce((s, t) => s + t.driverCents, 0),
    streakDays: computeStreak(thankYous.map((t) => t.createdAt)),
    recentThankYous: newestFirst(thankYous).slice(0, 30),
    recentTips: newestFirst(tips).slice(0, 30),
    milestones,
  };
}

export type PlatformStats = {
  grossTipVolumeCents: number;
  tipCount: number;
  averageTipCents: number;
  grossPlatformFeeCents: number;
  paymentFeeCents: number;
  payoutFeeCents: number;
  netRevenueCents: number;
  revenuePerTransactionCents: number;
  freeThankYouCount: number;
  scanCount: number;
  scanToPaymentRate: number;
  scanToThankYouRate: number;
  activeDrivers: number;
  totalDrivers: number;
  totalCustomers: number;
  openCardOrders: number;
  pendingBadgeRequests: number;
};

export async function getPlatformStats(scope: "today" | "all" = "all"): Promise<PlatformStats> {
  const db = getDb();
  const since = scope === "today" ? { field: "createdAt" as const, value: startOfTodayIso() } : undefined;

  const [tips, thankYous, scanCount, totalDrivers, totalCustomers, pendingBadgeRequests, openOrders] =
    await Promise.all([
      db.tips.findMany({ where: { paymentStatus: "succeeded" }, since }),
      db.thankYous.findMany({ since }),
      db.scans.count({ since }),
      db.driverProfiles.count(),
      db.customerProfiles.count(),
      db.driverProfiles.count({ where: { verification: "pending" } }),
      db.cardOrders.findMany(),
    ]);

  const sum = (pick: (tip: Tip) => number) => tips.reduce((total, tip) => total + pick(tip), 0);
  const gross = sum((t) => t.grossCents);
  const net = sum((t) => t.platformNetRevenueCents);

  return {
    grossTipVolumeCents: gross,
    tipCount: tips.length,
    averageTipCents: tips.length ? Math.round(gross / tips.length) : 0,
    grossPlatformFeeCents: sum((t) => t.platformGrossFeeCents),
    paymentFeeCents: sum((t) => t.paymentProviderFeeCents),
    payoutFeeCents: sum((t) => t.payoutFeeCents),
    netRevenueCents: net,
    revenuePerTransactionCents: tips.length ? Math.round(net / tips.length) : 0,
    freeThankYouCount: thankYous.filter((t) => !t.tipId).length,
    scanCount,
    scanToPaymentRate: scanCount ? tips.length / scanCount : 0,
    scanToThankYouRate: scanCount ? thankYous.length / scanCount : 0,
    activeDrivers: new Set(tips.map((t) => t.driverId)).size,
    totalDrivers,
    totalCustomers,
    openCardOrders: openOrders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
    pendingBadgeRequests,
  };
}

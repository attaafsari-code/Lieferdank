import { api } from "@/server/api/handler";
import { getDriverStats } from "@/server/services/stats";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "driver" }, async ({ session }) => {
  const stats = await getDriverStats(session!.driver!.id);
  return {
    today: stats.today,
    week: stats.week,
    month: stats.month,
    total: stats.total,
    balanceCents: stats.balanceCents,
    paidOutCents: stats.paidOutCents,
    streakDays: stats.streakDays,
    // Kundenbezug wird nie an den Zusteller ausgeliefert.
    recentThankYous: stats.recentThankYous.map(({ customerId: _c, ...rest }) => rest),
    recentTips: stats.recentTips.map(({ id, driverCents, grossCents, payoutStatus, createdAt }) => ({
      id,
      driverCents,
      grossCents,
      payoutStatus,
      createdAt,
    })),
    milestones: stats.milestones,
  };
});

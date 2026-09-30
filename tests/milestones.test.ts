import { describe, expect, it } from "vitest";
import { describeMilestone, nextThankYouMilestone, reachedMilestones } from "@/lib/milestone-rules";
import { computeStreak } from "@/server/services/stats";

describe("Meilensteine", () => {
  it("zeigt immer die nächste vorhandene Danke-Stufe", () => {
    expect(nextThankYouMilestone(0)).toBe(1);
    expect(nextThankYouMilestone(1)).toBe(10);
    expect(nextThankYouMilestone(9)).toBe(10);
    expect(nextThankYouMilestone(10)).toBe(50);
    expect(nextThankYouMilestone(1000)).toBeNull();
  });
  it("vergibt nichts ohne Danke", () => {
    expect(reachedMilestones({ thankYouCount: 0, streakDays: 0, tipCount: 0, receivedCents: 0 })).toEqual([]);
  });

  it("erkennt 10, 50, 100 Danke, erstes Trinkgeld, 5 Tage und 100 €", () => {
    const reached = reachedMilestones({ thankYouCount: 120, streakDays: 6, tipCount: 3, receivedCents: 10_050 });
    const keys = reached.map((m) => `${m.type}:${m.value}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        "thank_you_count:1",
        "thank_you_count:10",
        "thank_you_count:50",
        "thank_you_count:100",
        "streak_days:5",
        "first_tip:1",
        "received_cents:10000",
      ]),
    );
    expect(keys).not.toContain("thank_you_count:500");
  });

  it("beschreibt Meilensteine auf Deutsch", () => {
    expect(describeMilestone("received_cents", 10_000).title).toBe("100 € erhalten");
    expect(describeMilestone("first_tip", 1).title).toBe("Dein erstes Trinkgeld");
  });
});

describe("Serie", () => {
  const at = (daysAgo: number) => {
    const d = new Date("2026-09-20T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString();
  };
  const now = new Date("2026-09-20T15:00:00Z");

  it("zählt aufeinanderfolgende Tage", () => {
    expect(computeStreak([at(0), at(1), at(2), at(4)], now)).toBe(3);
  });

  it("bricht nicht, wenn heute noch kein Danke kam", () => {
    expect(computeStreak([at(1), at(2)], now)).toBe(2);
  });

  it("ist null ohne Danke gestern und heute", () => {
    expect(computeStreak([at(3)], now)).toBe(0);
  });
});

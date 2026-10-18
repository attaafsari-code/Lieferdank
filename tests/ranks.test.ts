import { expect, it } from "vitest";
import { RANKS, rankProgress } from "@/lib/ranks";

it.each([
  [0, null, 1], [1, "start", 50], [49, "start", 50], [50, "bronze", 100], [99, "bronze", 100],
  [100, "copper", 500], [499, "copper", 500], [500, "silver", 1000], [999, "silver", 1000],
  [1000, "gold", 2000], [1999, "gold", 2000], [2000, "platinum", 5000], [4999, "platinum", 5000],
  [5000, "diamond", 10000], [9999, "diamond", 10000], [10000, "legend", null], [15000, "legend", null],
] as const)("%s valid thanks: rank %s, next %s", (count, current, next) => {
  const p = rankProgress(count);
  expect(p.current?.id ?? null).toBe(current); expect(p.next?.threshold ?? null).toBe(next);
  expect(p.remaining).toBe(Math.max(0, (next ?? 10000) - count));
  expect(p.percent).toBe(Math.min(100, Math.floor(count * 100 / (next ?? 10000))));
  expect(p.maximum).toBe(next === null);
  expect(p.unlockedColors).toEqual(RANKS.filter(r => r.threshold <= count && r.id !== "start").map(r => r.id));
});
it("rejects impossible counts and has exactly the approved tiers", () => {
  for (const n of [-1, 1.5, NaN, Infinity]) expect(() => rankProgress(n)).toThrow();
  expect(RANKS.map(r => r.threshold)).toEqual([1,50,100,500,1000,2000,5000,10000]);
});

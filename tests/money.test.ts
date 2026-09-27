import { describe, expect, it } from "vitest";
import { allocateFee, isAllowedTipAmount, splitTip, TIP_OPTIONS_CENTS } from "@/lib/money";

describe("Trinkgeld-Aufteilung", () => {
  it.each([
    [200, 150],
    [300, 250],
    [500, 450],
  ])("%i Cent → Lieferant erhält %i Cent", (gross, driver) => {
    const split = splitTip(gross);
    expect(split.grossCents).toBe(gross);
    expect(split.driverCents).toBe(driver);
    expect(split.platformGrossFeeCents).toBe(50);
    expect(split.driverCents + split.platformGrossFeeCents).toBe(gross);
  });

  it("bietet genau 2, 3 und 5 € an", () => {
    expect([...TIP_OPTIONS_CENTS]).toEqual([200, 300, 500]);
  });

  it("trennt Bruttogebühr, Paymentkosten und Nettomarge", () => {
    const split = splitTip(300);
    expect(split.paymentProviderFeeCents).toBe(30); // 1,5 % + 25 Cent
    expect(split.platformNetRevenueCents).toBe(20);
    expect(split.payoutFeeCents).toBe(0);
  });

  it("erlaubt ausschließlich die veröffentlichten Beträge", () => {
    for (const amount of [200, 300, 500]) expect(isAllowedTipAmount(amount)).toBe(true);
    for (const amount of [0, 100, 199, 250, 400, 600, -1, 999999, NaN, 250.5]) {
      expect(isAllowedTipAmount(amount)).toBe(false);
    }
  });

  it("lehnt ungültige Beträge ab", () => {
    expect(() => splitTip(0)).toThrow();
    expect(() => splitTip(-100)).toThrow();
    expect(() => splitTip(1.5)).toThrow();
  });
});

describe("Verteilung der Auszahlungsgebühr", () => {
  it("verteilt cent-genau und verliert keinen Cent", () => {
    for (const [fee, count] of [[10, 3], [37, 7], [0, 4], [5, 5], [1, 9]]) {
      const shares = allocateFee(fee, count);
      expect(shares).toHaveLength(count);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(fee);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
  });

  it("gibt bei null Trinkgeldern eine leere Liste zurück", () => {
    expect(allocateFee(10, 0)).toEqual([]);
  });
});

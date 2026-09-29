import { describe, expect, it } from "vitest";
import { isAllowedTipAmount, splitTip, TIP_OPTIONS_CENTS } from "@/lib/money";

describe("Trinkgeld-Aufteilung", () => {
  it.each([
    [200, 150, 50],
    [300, 240, 60],
    [500, 400, 100],
  ])("%i Cent → %i Cent vor Stripe-Kosten, %i Cent Application Fee", (gross, driver, fee) => {
    const split = splitTip(gross);
    expect(split.grossCents).toBe(gross);
    expect(split.driverCents).toBe(driver);
    expect(split.platformGrossFeeCents).toBe(fee);
    expect(split.driverCents + split.platformGrossFeeCents).toBe(gross);
  });

  it("bietet genau 2, 3 und 5 € an", () => {
    expect([...TIP_OPTIONS_CENTS]).toEqual([200, 300, 500]);
  });

  it("belastet Stripe-Kosten nicht planmäßig der Lieferdank-Gebühr", () => {
    const split = splitTip(300);
    expect(split.paymentProviderFeeCents).toBe(0);
    expect(split.platformNetRevenueCents).toBe(60);
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
    expect(() => splitTip(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it("hält die Finanzinvarianten für alle unterstützten Beträge und Cent-Grenzwerte ein", () => {
    for (const gross of TIP_OPTIONS_CENTS) {
      const split = splitTip(gross);
      expect(Number.isSafeInteger(split.driverCents)).toBe(true);
      expect(split.driverCents).toBeGreaterThanOrEqual(0);
      expect(split.platformGrossFeeCents).toBeGreaterThanOrEqual(0);
      expect(split.driverCents + split.platformGrossFeeCents).toBe(gross);
      expect(isAllowedTipAmount(gross)).toBe(true);
    }
  });
});

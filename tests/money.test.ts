import { describe, expect, it } from "vitest";
import {
  effectiveTip, isAllowedTipAmount, parseEuroToCents, proportionalFeeRefundCents, refundPreview, splitTip, TIP_OPTIONS_CENTS,
} from "@/lib/money";

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

describe("Erstattungen", () => {
  it("gibt die Gebühr anteilig und abgerundet zurück, bei vollständiger Erstattung ganz", () => {
    expect(proportionalFeeRefundCents(60, 300, 0)).toBe(0);
    expect(proportionalFeeRefundCents(60, 300, 100)).toBe(20);
    expect(proportionalFeeRefundCents(60, 300, 7)).toBe(1);
    expect(proportionalFeeRefundCents(50, 200, 3)).toBe(0);
    expect(proportionalFeeRefundCents(50, 200, 199)).toBe(49);
    expect(proportionalFeeRefundCents(50, 200, 200)).toBe(50);
    expect(proportionalFeeRefundCents(60, 0, 100)).toBe(0);
    // Für jeden Teilbetrag: nie mehr als der Anteil, nie mehr als die Gebühr, monoton steigend.
    for (const gross of TIP_OPTIONS_CENTS) {
      const fee = splitTip(gross).platformGrossFeeCents;
      let previous = 0;
      for (let refunded = 0; refunded <= gross; refunded++) {
        const back = proportionalFeeRefundCents(fee, gross, refunded);
        expect(back).toBeGreaterThanOrEqual(previous);
        expect(back * gross).toBeLessThanOrEqual(fee * refunded);
        previous = back;
      }
      expect(previous).toBe(fee);
    }
  });

  it("rechnet Einnahmen und Gebühr nach Erstattungen", () => {
    const tip = { ...splitTip(300), refundedCents: 0, feeRefundedCents: 0 };
    expect(effectiveTip(tip)).toEqual({ grossCents: 300, driverCents: 240, platformFeeCents: 60 });
    expect(effectiveTip({ ...tip, refundedCents: 100, feeRefundedCents: 20 })).toEqual({ grossCents: 200, driverCents: 160, platformFeeCents: 40 });
    expect(effectiveTip({ ...tip, refundedCents: 300, feeRefundedCents: 60 })).toEqual({ grossCents: 0, driverCents: 0, platformFeeCents: 0 });
    // Ältere Datensätze ohne Erstattungsspalten zählen unverändert.
    expect(effectiveTip(splitTip(500))).toEqual({ grossCents: 500, driverCents: 400, platformFeeCents: 100 });
  });

  it("liest Euro-Eingaben eindeutig oder gar nicht", () => {
    expect(parseEuroToCents("1,50")).toBe(150);
    expect(parseEuroToCents("1.5")).toBe(150);
    expect(parseEuroToCents("2")).toBe(200);
    expect(parseEuroToCents(" 2,05 € ")).toBe(205);
    expect(parseEuroToCents("0,01")).toBe(1);
    for (const input of ["", "abc", "1,505", "-1", "1.000,00", "1e2", ",50", "2,"]) expect(parseEuroToCents(input)).toBeNull();
  });

  it("zeigt vor der Bestätigung, was die Erstattung bewirkt", () => {
    const tip = { ...splitTip(300), refundedCents: 100, feeRefundedCents: 20 };
    expect(refundPreview(tip, 200)).toEqual({
      customerCents: 200, feeBackCents: 40, driverBearsCents: 160, complete: true,
      after: { grossCents: 0, driverCents: 0, platformFeeCents: 0 },
    });
    expect(refundPreview({ ...tip, refundedCents: 0, feeRefundedCents: 0 }, 100)).toMatchObject({
      customerCents: 100, feeBackCents: 20, driverBearsCents: 80, complete: false, after: { driverCents: 160, platformFeeCents: 40 },
    });
    // Wurde schon mehr Gebühr zurückgegeben als anteilig, kommt nichts dazu.
    expect(refundPreview({ ...tip, refundedCents: 0, feeRefundedCents: 50 }, 100)).toMatchObject({ feeBackCents: 0, driverBearsCents: 100 });
  });
});

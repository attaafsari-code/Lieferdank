import { expect, it } from "vitest";
import { cardDocument, CARD_PAPER, printWasCancelled } from "../src/card-document";
it("keeps vector QR, personalization and fixed physical card size on A4", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 85.6 54"><text>Danke an Änne</text><path d="M1 1h5v5z"/></svg>';
  const html = cardDocument(svg);
  expect(html).toContain(svg); expect(html).toContain("aspect-ratio:85.6/54"); expect(html).toContain("size:A4");
  expect(html).toContain('content="width=device-width, initial-scale=1.0"');
  const widthPercent = Number(/width:([\d.]+)%/.exec(html)![1]);
  expect(widthPercent / 100 * 210).toBeCloseTo(85.6, 5);
  const topPercent = Number(/margin:([\d.]+)%/.exec(html)![1]);
  expect(topPercent / 100 * 210).toBeCloseTo(20, 5);
  expect(CARD_PAPER.width / CARD_PAPER.height).toBeCloseTo(210 / 297, 3);
});
it("prevents script, foreign content and external image loads in the native print view", () => {
  for (const svg of ['<svg><script>alert(1)</script></svg>', '<svg onload="attack()"/>', '<svg><foreignObject/></svg>', '<svg><image href="https://attacker.invalid/track"/></svg>']) expect(() => cardDocument(svg)).toThrow();
  expect(() => cardDocument('<svg><image href="data:image/png;base64,YQ=="/></svg>')).not.toThrow();
});
it("treats only a dismissed iOS print dialog as cancellation, never an actual printer failure", () => {
  expect(printWasCancelled({ code: "ERR_PRINT_INCOMPLETE" })).toBe(true);
  for (const error of [null, new Error("printer offline"), { code: "ERR_PRINTING_JOB_FAILED" }]) expect(printWasCancelled(error)).toBe(false);
});

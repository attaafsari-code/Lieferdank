import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RankBadge, RankJourney, RankSummary } from "@/components/ranks";
import { rankProgress } from "@/lib/ranks";
import { readFileSync } from "node:fs";
it("keeps badges explicitly sized, including when nested in a journey", () => {
  const badge = renderToStaticMarkup(createElement(RankBadge, { id: "legend", size: 44 }));
  expect(badge).toContain('width="44" height="55"');
  expect(badge).toContain('style="display:block;flex-shrink:0;width:44px;height:55px"');
  const journey = renderToStaticMarkup(createElement(RankJourney, { progress: rankProgress(500) }));
  expect(journey.match(/width="44" height="55"/g)).toHaveLength(8);
  expect(journey).toContain("Rewards sind derzeit nicht beanspruchbar.");
  expect(journey).toContain("accent-color:#8293A6");
  expect(journey).not.toContain("Beanspruchen");
});
it("shows a capped maximum without an impossible next target at 10000+", () => {
  const text = renderToStaticMarkup(createElement(RankSummary, { progress: rankProgress(15000) }));
  expect(text).toContain("Höchster Rang erreicht: Legende");
  expect(text).toContain("15.000 gültige Danke");
  expect(text).not.toContain("15.000 von 10.000");
  expect(text).toContain('value="10000" max="10000"');
});
it("documents public rank visibility without exposing private reward drafts or tip amounts", () => {
  const privacy = readFileSync("src/app/(site)/legal/datenschutz/page.tsx", "utf8");
  expect(privacy).toContain("Anzahl gültiger Danke, den aktuellen Rang und erreichte Rangstufen");
  expect(privacy).toContain("Private Reward-Entwürfe und Trinkgeldbeträge werden dort nicht veröffentlicht");
});

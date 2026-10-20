import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RANKS } from "@/lib/ranks";
import { CardDesigner } from "@/app/dashboard/karte/card-designer";
import AdminRankPreview from "@/app/admin/raenge/vorschau/page";
import { previewSelection } from "@/app/admin/raenge/vorschau/selection";

vi.mock("@/server/guards", () => ({ requireAdmin: vi.fn(async () => undefined) }));
vi.mock("@/server/actions/driver", () => ({ saveCardDesignAction: vi.fn() }));

it("offers exactly the eight established ranks and only colors unlocked at each threshold", () => {
  expect(RANKS.map(item => item.label)).toEqual(["Start", "Bronze", "Kupfer", "Silber", "Gold", "Platin", "Diamant", "Legende"]);
  for (const rank of RANKS) for (const layout of ["classic", "brand", "personal"] as const) {
    const selected = previewSelection({ rang: rank.id, layout, farbe: "legend" });
    expect(selected.rank.id).toBe(rank.id);
    expect(selected.layout).toBe(layout);
    expect(selected.unlockedColors.map(item => item.requiredThanks).every(required => required <= rank.threshold)).toBe(true);
    expect(selected.color).toBe(rank.id === "legend" ? "legend" : "blue");
  }
  expect(previewSelection({ rang: "forged", layout: "forged", farbe: "legend" }).rank.id).toBe("start");
});

it("checks server-side admin access before rendering an isolated, non-driver preview", async () => {
  const { requireAdmin } = await import("@/server/guards");
  vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("forbidden"));
  await expect(AdminRankPreview({ searchParams: Promise.resolve({ rang: "gold" }) })).rejects.toThrow("forbidden");
  const html = renderToStaticMarkup(await AdminRankPreview({ searchParams: Promise.resolve({ rang: "gold", layout: "personal", abzeichen: "aus" }) }));
  expect(html).toContain("Isolierte Rangvorschau");
  expect(html).toContain("simuliertes Profil");
  expect(html).toContain("Abzeichen aus");
  expect(html).not.toContain("/danke/LD-VORSCHAU");
});

it("puts the badge switch immediately after layouts and keeps rank colors collapsed by default", () => {
  const html = renderToStaticMarkup(createElement(CardDesigner, {
    initial: { layout: "classic", color: "blue", headline: "Danke", showPhoto: false, showProvider: false, showRankBadge: true, updatedAt: "2026-10-20T00:00:00.000Z" },
    qrSvg: '<svg viewBox="0 0 1 1"></svg>', publicName: "Vorschau", initials: "V", photoUrl: null, code: "LD-VORSCHAU",
  }));
  expect(html.indexOf("Rangabzeichen auf Karte anzeigen")).toBeGreaterThan(html.indexOf("Design"));
  expect(html.indexOf("Rangfarben")).toBeGreaterThan(html.indexOf("Rangabzeichen auf Karte anzeigen"));
  expect(html).toContain("<details");
  expect(html).not.toContain("<details open=");
});

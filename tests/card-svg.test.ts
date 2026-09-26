import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { escapeXml, renderCardSvg, wrapText } from "@/lib/card/svg";
import type { CardLayout } from "@/lib/db/types";

async function qr() {
  return QRCode.toString("https://lieferdank.de/danke/LD-TEST1", { type: "svg", margin: 0 });
}

describe("Karten-SVG", () => {
  it.each<CardLayout>(["classic", "brand", "personal"])("rendert Layout %s im Scheckkartenformat", async (layout) => {
    const svg = renderCardSvg({
      layout,
      headline: "Danke für deine Wertschätzung ❤",
      publicName: "Max",
      providerLabel: "DHL",
      code: "LD-TEST1",
      qrSvg: await qr(),
      avatar: { href: null, initials: "M" },
    });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="85.6mm"');
    expect(svg).toContain('height="54mm"');
    expect(svg).toContain("Max");
    expect(svg).toContain("unterwegs für DHL");
    expect(svg).toContain("LD-TEST1");
    expect(svg).toContain("KEINE APP NÖTIG");
    expect(svg).toContain("QR SCANNEN &amp; DANKE SAGEN");
    expect(svg).toContain("Danke sagen kostenlos · Trinkgeld freiwillig");
    // Der QR-Code ist eingebettet, nicht verlinkt.
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toContain("var(--");
  });

  it("maskiert Nutzereingaben – kein SVG-/Script-Einschleusen über Namen oder Text", async () => {
    const svg = renderCardSvg({
      layout: "classic",
      headline: '<script>alert("x")</script>',
      publicName: 'Max"><image href=x onerror=alert(1)>',
      providerLabel: null,
      code: "LD-TEST1",
      qrSvg: await qr(),
      avatar: null,
    });
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<image href=x");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("blendet den Lieferdienst aus, wenn er nicht gezeigt werden soll", async () => {
    const svg = renderCardSvg({
      layout: "classic",
      headline: "Hallo",
      publicName: "Max",
      providerLabel: null,
      code: "LD-TEST1",
      qrSvg: await qr(),
      avatar: null,
    });
    expect(svg).not.toContain("unterwegs für");
  });

  it("vergibt eindeutige IDs für mehrere Karten auf einer Seite", async () => {
    const make = (idPrefix: string) =>
      qr().then((qrSvg) =>
        renderCardSvg({ layout: "classic", headline: "x", publicName: "Max", providerLabel: null, code: "LD-TEST1", qrSvg, avatar: { href: "data:image/png;base64,AA==", initials: "M" }, idPrefix }),
      );
    const [a, b] = await Promise.all([make("a"), make("b")]);
    expect(a).toContain('id="a-av"');
    expect(b).toContain('id="b-av"');
  });
});

describe("Zeilenumbruch", () => {
  it("hält die maximale Zeilenzahl ein und kürzt mit …", () => {
    const lines = wrapText("Danke, dass ich dir heute dein Paket bringen durfte und noch viel mehr Text", 3.2, 30, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[lines.length - 1].endsWith("…")).toBe(true);
  });

  it("lässt kurze Texte unverändert", () => {
    expect(wrapText("Danke!", 3.2, 40, 2)).toEqual(["Danke!"]);
  });

  it("escapeXml ersetzt alle Sonderzeichen", () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
  });
});

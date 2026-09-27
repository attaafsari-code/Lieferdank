import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { detectImageType, MAX_PHOTO_BYTES, validatePhoto } from "@/server/storage";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("Foto-Upload", () => {
  it("erkennt Bilder an der Dateisignatur", () => {
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(webp)).toBe("image/webp");
  });

  it("lehnt getarnte Dateien ab", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    await expect(validatePhoto(html)).rejects.toThrow(/JPG/);
    await expect(validatePhoto(svg)).rejects.toThrow(/JPG/);
  });

  it("lehnt leere und zu große Dateien ab", async () => {
    await expect(validatePhoto(new Uint8Array())).rejects.toThrow(/leer/);
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(jpeg);
    await expect(validatePhoto(big)).rejects.toThrow(/zu groß/);
  });

  it("lehnt Bilder ab, die nur eine gültige Dateisignatur vortäuschen", async () => {
    await expect(validatePhoto(jpeg)).rejects.toThrow(/beschädigt/);
    await expect(validatePhoto(png)).rejects.toThrow(/beschädigt/);
    await expect(validatePhoto(webp)).rejects.toThrow(/beschädigt/);
  });

  it("akzeptiert und normalisiert ein vollständig decodierbares Foto", async () => {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#204060" } })
      .jpeg().toBuffer();
    const photo = await validatePhoto(new Uint8Array(bytes));
    expect(photo.contentType).toBe("image/jpeg");
    expect((await sharp(photo.bytes).metadata()).width).toBe(16);
  });
});

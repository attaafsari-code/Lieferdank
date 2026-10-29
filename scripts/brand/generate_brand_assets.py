"""Leitet alle LieferDank-Logo-Dateien aus dem freigegebenen Original ab.

Quelle: assets/brand/lieferdank-logo-original.png (Bildmarke + Schriftzug + Claim).
Bildmarke: apps/driver/assets/brand-mark-approved.png, ein bereits freigegebener,
pixelgenauer Ausschnitt des Originals (wird hier gegen das Original geprüft).

Nichts wird neu gezeichnet: Schriftzug und Claim sind Ausschnitte des Originals,
der weiße Hintergrund wird rechnerisch entfernt („Farbe zu Alpha“ gegen Weiß).
Über Weiß gelegt ergibt jede Datei wieder die Originalpixel.
Das ®-Zeichen wird ausgelassen (siehe docs/BRANDING.md).

Aufruf aus dem Repository-Wurzelverzeichnis:  python3 -I scripts/brand/generate_brand_assets.py
"""

import base64
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / "assets/brand/lieferdank-logo-original.png"
APPROVED_MARK = ROOT / "apps/driver/assets/brand-mark-approved.png"
MARK_OFFSET = (380, 35)  # Lage des freigegebenen Bildmarken-Ausschnitts im Original
WORDMARK_BOX = (161, 528, 1613, 743)
TAGLINE_BOX = (429, 773, 1349, 827)
REGISTERED_BOX = (1588, 674, 1641, 724)
PAD = 12
APP_ICON = ROOT / "apps/driver/assets/app-icon.png"  # freigegebenes App-Icon
SPLASH_SIZES = [(1320, 2868), (1206, 2622), (1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532), (1125, 2436), (750, 1334)]


def color_to_alpha(rgb: np.ndarray) -> np.ndarray:
    """Weiß → transparent. Komposition über Weiß reproduziert die Eingabe."""
    c = rgb.astype(np.float64)
    alpha = np.max((255.0 - c) / 255.0, axis=2)
    safe = np.where(alpha > 0, alpha, 1.0)[..., None]
    out = np.clip((c - 255.0) / safe + 255.0, 0, 255)
    a = np.round(alpha * 255.0)
    a[a < 8] = 0  # Kompressionsrauschen des Hintergrunds, kein Logobestandteil
    rgba = np.dstack([np.round(out), a]).astype(np.uint8)
    rgba[a == 0, :3] = 255
    return rgba


def isolate(rgb: np.ndarray, box: tuple[int, int, int, int], drop: tuple[int, int, int, int] | None = None) -> np.ndarray:
    """Behält nur Logoteile, die vollständig im Ausschnitt liegen.

    So ragen weder Paket noch Herz in den Schriftzug, und das ®-Zeichen (drop)
    wird entfernt, ohne die Pixel des „k“ anzutasten.
    """
    x0, y0, x1, y1 = box
    region = rgb[y0 - PAD:y1 + PAD, x0 - PAD:x1 + PAD].copy()
    labels, _ = ndimage.label(np.min(region, axis=2) < 250)
    removed = 0
    height, width = labels.shape
    for label, slices in enumerate(ndimage.find_objects(labels), start=1):
        ys, xs = slices
        top, bottom, left, right = ys.start + y0 - PAD, ys.stop + y0 - PAD, xs.start + x0 - PAD, xs.stop + x0 - PAD
        # Teile, die am Rand des Ausschnitts angeschnitten sind, gehören zu Paket oder Herz.
        outside = ys.start == 0 or xs.start == 0 or ys.stop == height or xs.stop == width
        dropped = drop is not None and left >= drop[0] and right <= drop[2] and top >= drop[1] and bottom <= drop[3]
        if outside or dropped:
            region[labels == label] = 255
            removed += int(dropped)
    if drop is not None and removed == 0:
        sys.exit("®-Zeichen nicht gefunden – Ausschnitt prüfen")
    return region


def cut(rgb: np.ndarray, box: tuple[int, int, int, int], drop: tuple[int, int, int, int] | None = None) -> Image.Image:
    return Image.fromarray(color_to_alpha(isolate(rgb, box, drop)), "RGBA")


def check_mark(original: np.ndarray) -> None:
    mark = np.asarray(Image.open(APPROVED_MARK).convert("RGBA")).astype(np.float64)
    a = mark[..., 3:4] / 255.0
    over_white = mark[..., :3] * a + 255.0 * (1 - a)
    x, y = MARK_OFFSET
    region = original[y:y + mark.shape[0], x:x + mark.shape[1]].astype(np.float64)
    diff = np.abs(over_white - region).mean()
    if diff > 2.0:
        sys.exit(f"Bildmarke weicht vom Original ab (mittlere Abweichung {diff:.2f})")
    print(f"Bildmarke = Original-Ausschnitt (mittlere Abweichung {diff:.2f} von 255)")


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {image.width}×{image.height}")


def lockup_without_registered(original: np.ndarray) -> Image.Image:
    """Komplettes Original (Bildmarke, Schriftzug, Claim) ohne ®, auf seinen Inhalt zugeschnitten."""
    x0, y0, x1, y1 = REGISTERED_BOX
    region = original[y0:y1, x0:x1]
    labels, _ = ndimage.label(np.min(region, axis=2) < 250)
    cleaned = original.copy()
    for label, (ys, xs) in enumerate(ndimage.find_objects(labels), start=1):
        if ys.start > 0 and xs.start > 0 and ys.stop < labels.shape[0] and xs.stop < labels.shape[1]:
            cleaned[y0:y1, x0:x1][labels == label] = 255
    image = Image.fromarray(cleaned, "RGB")
    ink = Image.fromarray((np.min(cleaned, axis=2) < 235).astype(np.uint8) * 255)
    left, top, right, bottom = ink.getbbox()
    return image.crop((left - PAD, top - PAD, right + PAD, bottom + PAD))


def on_white(width: int, height: int, parts: list[tuple[Image.Image, int, int, int]]) -> Image.Image:
    """Setzt Logoteile (Bild, x, y, Breite) unverzerrt auf eine weiße Fläche."""
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    for image, x, y, w in parts:
        scaled = image.convert("RGBA").resize((w, round(image.height * w / image.width)), Image.LANCZOS)
        canvas.alpha_composite(scaled, (x, y))
    return canvas.convert("RGB")


def centered(image: Image.Image, width: int, height: int, share: float, lift: float = 0.0) -> Image.Image:
    w = round(width * share)
    h = round(image.height * w / image.width)
    return on_white(width, height, [(image, (width - w) // 2, round((height - h) / 2 - lift * height), w)])


def web_images(original: np.ndarray, mark: Image.Image, wordmark: Image.Image) -> None:
    icon = Image.open(APP_ICON).convert("RGB")
    lockup = lockup_without_registered(original)
    for size, path in [(192, "public/pwa/icon-192.png"), (512, "public/pwa/icon-512.png"), (512, "src/app/icon.png"), (180, "src/app/apple-icon.png")]:
        save(icon.resize((size, size), Image.LANCZOS), ROOT / path)
    # Android beschneidet maskierbare Icons auf einen Kreis: Bildmarke innerhalb der 80-%-Zone.
    save(centered(mark, 512, 512, 0.62), ROOT / "public/pwa/maskable-512.png")
    favicon = ROOT / "src/app/favicon.ico"
    icon.save(favicon, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"{favicon.relative_to(ROOT)}  16/32/48")
    for w, h in SPLASH_SIZES:
        save(centered(lockup, w, h, 0.64, lift=0.03), ROOT / f"public/pwa/splash/{w}x{h}.png")
    save(centered(lockup, 1200, 630, 0.62), ROOT / "src/app/opengraph-image.png")
    # Stripe Checkout zeigt ein breites Logo: Bildmarke und Schriftzug nebeneinander,
    # im selben Größenverhältnis wie in der Kopfzeile der Website.
    mark_h, gap = 170, 24
    mark_w = round(mark.width * mark_h / mark.height)
    word_h = round(mark_h * 0.61)
    word_w = round(wordmark.width * word_h / wordmark.height)
    x = (1024 - mark_w - gap - word_w) // 2
    save(on_white(1024, 256, [(mark, x, (256 - mark_h) // 2, mark_w), (wordmark, x + mark_w + gap, (256 - word_h) // 2, word_w)]),
         ROOT / "public/brand/checkout-logo.png")


def data_uri(image: Image.Image, width: int) -> str:
    height = round(image.height * width / image.width)
    buffer = io.BytesIO()
    image.resize((width, height), Image.LANCZOS).save(buffer, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def main() -> None:
    original = np.asarray(Image.open(ORIGINAL).convert("RGB"))
    check_mark(original)
    wordmark = cut(original, WORDMARK_BOX, REGISTERED_BOX)
    tagline = cut(original, TAGLINE_BOX)
    mark = Image.open(APPROVED_MARK).convert("RGBA")

    save(mark, ROOT / "public/brand/lieferdank-mark.png")
    save(wordmark, ROOT / "public/brand/lieferdank-wordmark.png")
    save(tagline, ROOT / "public/brand/lieferdank-tagline.png")
    save(wordmark, ROOT / "apps/driver/assets/brand-wordmark.png")
    web_images(original, mark, wordmark)

    # Für Karten und serverseitig gerenderte Bilder eingebettet, damit SVG-, PNG- und
    # Druckexporte ohne Nachladen funktionieren. 400 bzw. 700 px Breite entsprechen bei
    # Kartengröße deutlich über 1000 dpi.
    module = (
        "// Automatisch erzeugt von scripts/brand/generate_brand_assets.py – nicht von Hand ändern.\n"
        "// Ausschnitte des freigegebenen Original-Logos (assets/brand/lieferdank-logo-original.png).\n\n"
        f'export const BRAND_MARK = {{ href: "{data_uri(mark, 400)}", width: {mark.width}, height: {mark.height} }};\n'
        f'export const BRAND_WORDMARK = {{ href: "{data_uri(wordmark, 700)}", width: {wordmark.width}, height: {wordmark.height} }};\n'
        f'export const BRAND_TAGLINE = {{ href: "{data_uri(tagline, 500)}", width: {tagline.width}, height: {tagline.height} }};\n'
    )
    target = ROOT / "src/lib/brand/logo-images.ts"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(module)
    print(f"{target.relative_to(ROOT)}  {len(module) // 1024} KB")


if __name__ == "__main__":
    main()

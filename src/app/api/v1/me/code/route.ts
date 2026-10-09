import { readDriverPhoto } from "@/server/services/profile";
import { renderDriverCard } from "@/server/services/cards";
import { api } from "@/server/api/handler";
import { qrSvgWithQuietZone, qrPngDataUrl, thankYouUrl } from "@/server/qr";

export const dynamic = "force-dynamic";

/** Code, Ziel-URL und QR-Code als SVG – für die Karten-Ansicht der App. */
export const GET = api({ auth: "driver" }, async ({ session }) => {
  const driver = session!.driver!;
  const url = thankYouUrl(driver.code);
  // Embed only the authenticated owner's normalized photo: no cookie-only relative URL in native SVG.
  const photo = driver.photoKey ? await readDriverPhoto(driver) : null;
  const photoHref = photo ? `data:${photo.contentType};base64,${Buffer.from(photo.bytes).toString("base64")}` : null;
  return { code: driver.code, url, qrSvg: await qrSvgWithQuietZone(url), qrPng: await qrPngDataUrl(url, 1000), cardSvg: await renderDriverCard(driver, session!.user, "native-card", photoHref) };
});

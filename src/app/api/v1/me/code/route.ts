import { api } from "@/server/api/handler";
import { qrSvgWithQuietZone, thankYouUrl } from "@/server/qr";

export const dynamic = "force-dynamic";

/** Code, Ziel-URL und QR-Code als SVG – für die Karten-Ansicht der App. */
export const GET = api({ auth: "driver" }, async ({ session }) => {
  const driver = session!.driver!;
  const url = thankYouUrl(driver.code);
  return { code: driver.code, url, qrSvg: await qrSvgWithQuietZone(url) };
});

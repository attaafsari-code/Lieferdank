import { api } from "@/server/api/handler";
import { notFound } from "@/server/errors";
import { findReceivingDriver, toPublicDriver } from "@/server/services/drivers";
import { recordScanFrom } from "@/server/services/thanks";
import { ipFromHeaders } from "@/server/rate-limit";
import { TIP_OPTIONS_CENTS, MIN_TIP_CENTS, MAX_TIP_CENTS } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Öffentliches Profil nach dem QR-Scan. ?scan=0 zählt nicht als Scan (z. B. App-Vorschau). */
export const GET = api<{ code: string }>({ rateLimit: { key: "api-driver", limit: 120, windowMs: 60_000 } }, async ({ request, params }) => {
  const found = await findReceivingDriver(params.code);
  if (!found) throw notFound("Dieser Danke-Code ist nicht aktiv.");
  if (new URL(request.url).searchParams.get("scan") !== "0") await recordScanFrom(found.driver.id, ipFromHeaders(request.headers));
  return {
    driver: toPublicDriver(found.driver, found.user),
    tipping: {
      optionsCents: TIP_OPTIONS_CENTS,
      minCents: MIN_TIP_CENTS,
      maxCents: MAX_TIP_CENTS,
    },
  };
});

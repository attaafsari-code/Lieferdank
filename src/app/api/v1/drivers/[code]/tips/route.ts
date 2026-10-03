import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { startTip } from "@/server/services/thanks";
import { paymentSubject, signMessageGrant } from "@/server/message-grant";

const body = z.object({ amountCents: z.number().int() });

/** Startet eine Zahlung. Die App öffnet `checkoutUrl` im In-App-Browser. */
export const POST = api<{ code: string }>({ rateLimit: { key: "api-tip", limit: 10, windowMs: 60_000 } }, async ({ request, params, session }) => {
  const { amountCents } = body.parse(await readJson(request));
  const result = await startTip(params.code, amountCents, session?.customer ? session.user.id : null);
  // Die App braucht wie der Web-Flow ein Schreibrecht für die optionale Nachricht nach Zahlung.
  const messageToken = await signMessageGrant([paymentSubject(result.paymentId)]);
  return { tipId: result.tipId, paymentId: result.paymentId, checkoutUrl: result.redirectUrl, messageToken };
});

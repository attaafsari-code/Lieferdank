import { api } from "@/server/api/handler";
import { blockSender } from "@/server/services/moderation";

/** Blockiert künftige Nachrichten des (pseudonymen) Absenders dieser Nachricht. */
export const POST = api<{ id: string }>({ auth: "driver", rateLimit: { key: "app-block", limit: 30, windowMs: 600000 } }, async ({ session, params }) => {
  await blockSender(session!.driver!.id, params.id); return { ok: true };
});

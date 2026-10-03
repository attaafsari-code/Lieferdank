import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { attachMessage } from "@/server/services/thanks";
import { readMessageGrant } from "@/server/message-grant";

const body = z.object({
  presetId: z.string().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  /** messageToken aus POST /drivers/{code}/thanks – das Schreibrecht des Absenders. */
  messageToken: z.string().max(4096),
});

export const POST = api<{ id: string }>({ rateLimit: { key: "api-message", limit: 20, windowMs: 60_000 } }, async ({ request, params }) => {
  const { presetId, message, messageToken } = body.parse(await readJson(request));
  await attachMessage(params.id, presetId ?? null, message ?? null, await readMessageGrant(messageToken));
  return { ok: true };
});

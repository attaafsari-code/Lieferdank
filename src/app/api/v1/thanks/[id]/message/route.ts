import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { attachMessage } from "@/server/services/thanks";

const body = z.object({ presetId: z.string().nullable().optional(), message: z.string().max(500).nullable().optional() });

export const POST = api<{ id: string }>({ rateLimit: { key: "api-message", limit: 20, windowMs: 60_000 } }, async ({ request, params }) => {
  const { presetId, message } = body.parse(await readJson(request));
  await attachMessage(params.id, presetId ?? null, message ?? null);
  return { ok: true };
});

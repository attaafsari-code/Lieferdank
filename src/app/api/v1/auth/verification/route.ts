import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { confirmEmail, parseInput } from "@/server/services/auth";
export const POST = api({ rateLimit: { key: "app-confirm-email", limit: 10, windowMs: 600000 } }, async ({ request }) => {
  const value = parseInput(z.object({ token: z.string().max(2048) }), await readJson(request)); await confirmEmail(value.token); return { ok: true };
});

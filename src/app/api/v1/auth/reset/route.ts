import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { parseInput, requestPasswordReset, completePasswordReset } from "@/server/services/auth";
export const POST = api({ rateLimit: { key: "app-reset", limit: 5, windowMs: 3600000 } }, async ({ request }) => {
  const input = parseInput(z.object({ email: z.string().trim().toLowerCase().email().max(200) }), await readJson(request));
  await requestPasswordReset(input.email); return { ok: true };
});
export const PATCH = api({ rateLimit: { key: "app-reset-complete", limit: 10, windowMs: 600000 } }, async ({ request }) => {
  const input = parseInput(z.object({ token: z.string().max(100), password: z.string().min(8).max(200) }), await readJson(request));
  await completePasswordReset(input.token, input.password); return { ok: true };
});

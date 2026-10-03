import { api, apiError } from "@/server/api/handler";
import { applyRetention } from "@/server/services/retention";

export const dynamic = "force-dynamic";

/**
 * Täglicher Lauf der Löschfristen (vercel.json → crons). Löscht nur Abgelaufenes und ist daher
 * auch bei fremdem Aufruf harmlos; ist CRON_SECRET gesetzt, wird zusätzlich der Vercel-Header geprüft.
 */
export const GET = api({ rateLimit: { key: "cron-retention", limit: 10, windowMs: 60 * 60_000 } }, async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError(401, "unauthorized", "Nicht berechtigt.");
  }
  return { ok: true, deleted: await applyRetention() };
});

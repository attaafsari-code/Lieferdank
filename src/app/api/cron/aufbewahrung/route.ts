import { api, apiError } from "@/server/api/handler";
import { applyRetention } from "@/server/services/retention";

export const dynamic = "force-dynamic";

/**
 * Täglicher Lauf der Löschfristen (vercel.json → crons). Ohne CRON_SECRET oder gültigen
 * Vercel-Header darf dieser schreibende Endpunkt niemals ausgeführt werden.
 */
export const GET = api({ rateLimit: { key: "cron-retention", limit: 10, windowMs: 60 * 60_000 } }, async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return apiError(503, "not_configured", "Löschlauf ist nicht eingerichtet.");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError(401, "unauthorized", "Nicht berechtigt.");
  }
  return { ok: true, deleted: await applyRetention() };
});

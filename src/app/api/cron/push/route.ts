import { api, apiError } from "@/server/api/handler";
import { collectPushEvents, deliverPush, checkPushReceipts, cleanupMobileData } from "@/server/services/push";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const GET = api({}, async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return apiError(401, "unauthorized", "Nicht berechtigt.");
  if (process.env.DRIVER_APP_ENABLED !== "true" || process.env.PUSH_ENABLED !== "true") return { enabled: false };
  await cleanupMobileData(); await collectPushEvents(); await checkPushReceipts(); return { sent: await deliverPush() };
});

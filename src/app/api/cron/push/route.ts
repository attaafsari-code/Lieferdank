import { api, apiError } from "@/server/api/handler";
import { collectPushEvents, deliverPush, checkPushReceipts, cleanupMobileData, pushAvailable } from "@/server/services/push";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const GET = api({}, async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return apiError(401, "unauthorized", "Nicht berechtigt.");
  if (process.env.DRIVER_APP_ENABLED !== "true") return { enabled: false };
  // Expired device sessions are cleaned up even while push itself is switched off.
  await cleanupMobileData();
  if (!pushAvailable()) return { enabled: false };
  await collectPushEvents(); await checkPushReceipts(); return { sent: await deliverPush() };
});

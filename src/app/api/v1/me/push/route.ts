import { api, readJson } from "@/server/api/handler";
import { pushAvailable, registerPush } from "@/server/services/push";
import { deviceId } from "@/server/services/mobile";
import { getDb } from "@/lib/db";
export const POST = api({ auth: "driver", rateLimit: { key: "app-push", limit: 20, windowMs: 600000 } }, async ({ session, request }) => { await registerPush(session!, await readJson(request)); return { ok: true }; });
export const DELETE = api({ auth: "driver" }, async ({ session }) => { await getDb().mobileSessions.update(deviceId(session!), { pushToken: null, pushEnabled: false }); return { ok: true }; });

// "available" tells the app whether to offer the switch at all; a stored opt-in never shows as active while push is off.
export const GET = api({ auth: "driver" }, async ({ session }) => {
  const available = pushAvailable();
  return { available, enabled: available && ((await getDb().mobileSessions.get(deviceId(session!)))?.pushEnabled ?? false) };
});

import { api, readJson } from "@/server/api/handler";
import { registerPush } from "@/server/services/push";
import { deviceId } from "@/server/services/mobile";
import { getDb } from "@/lib/db";
export const POST = api({ auth: "driver", rateLimit: { key: "app-push", limit: 20, windowMs: 600000 } }, async ({ session, request }) => { await registerPush(session!, await readJson(request)); return { ok: true }; });
export const DELETE = api({ auth: "driver" }, async ({ session }) => { await getDb().mobileSessions.update(deviceId(session!), { pushToken: null, pushEnabled: false }); return { ok: true }; });

export const GET = api({ auth: "driver" }, async ({ session }) => ({ enabled: (await getDb().mobileSessions.get(deviceId(session!)))?.pushEnabled ?? false }));

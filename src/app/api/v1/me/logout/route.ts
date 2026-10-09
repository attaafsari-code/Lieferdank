import { api } from "@/server/api/handler";
import { mobileLogout } from "@/server/services/mobile";
export const POST = api({ auth: "driver", rateLimit: { key: "app-logout", limit: 10, windowMs: 600000 } }, async ({ session }) => { await mobileLogout(session!); return { ok: true }; });

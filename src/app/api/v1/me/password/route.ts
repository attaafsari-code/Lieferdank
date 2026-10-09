import { api, readJson } from "@/server/api/handler";
import { changeMobilePassword } from "@/server/services/mobile";
export const POST = api({ auth: "driver", rateLimit: { key: "app-password", limit: 10, windowMs: 600000 } }, async ({ session, request }) => { await changeMobilePassword(session!, await readJson(request)); return { ok: true }; });

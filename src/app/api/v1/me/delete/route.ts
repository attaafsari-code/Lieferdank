import { api, readJson } from "@/server/api/handler";
import { removeMobileAccount } from "@/server/services/mobile";
export const POST = api({ auth: "driver", rateLimit: { key: "app-delete", limit: 10, windowMs: 600000 } }, async ({ session, request }) => { await removeMobileAccount(session!, await readJson(request)); return { ok: true }; });

import { api, readJson } from "@/server/api/handler";
import { enableDriver } from "@/server/services/roles";
export const POST = api({ auth: "any", rateLimit: { key: "enable-driver", limit: 5, windowMs: 600000 } }, async ({ session, request }) => {
  await enableDriver(session!.user, await readJson(request)); return { ok: true };
});

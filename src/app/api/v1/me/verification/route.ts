import { api } from "@/server/api/handler";
import { requestEmailVerification } from "@/server/services/auth";
export const POST = api({ auth: "driver", rateLimit: { key: "app-verification", limit: 3, windowMs: 3600000 } }, async ({ session }) => {
  await requestEmailVerification(session!.user); return { ok: true };
});

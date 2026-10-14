import { api } from "@/server/api/handler";
import { requestEmailVerification } from "@/server/services/auth";
import { ServiceError } from "@/server/errors";
export const POST = api({ auth: "any", rateLimit: { key: "app-verification", limit: 3, windowMs: 3600000 } }, async ({ session }) => {
  // The signed-in owner may learn whether the provider accepted the mail – no enumeration risk here.
  const { status } = await requestEmailVerification(session!.user);
  if (status === "not_sent") throw new ServiceError("mail_not_sent", "Die E-Mail konnte gerade nicht verschickt werden. Bitte versuche es später erneut.", 503);
  return { ok: true, status };
});

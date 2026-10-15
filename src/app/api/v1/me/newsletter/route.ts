import { api, readJson } from "@/server/api/handler";
import { z } from "zod";
import { newsletterStatus, requestNewsletter, revokeNewsletter } from "@/server/services/newsletter";

/** Freiwillige Einwilligung des eigenen Kontos. NEWSLETTER_ENABLED=false sperrt nur neue Anmeldungen. */
export const GET = api({ auth: "any" }, async ({ session }) => newsletterStatus(session!.user));
export const POST = api({ auth: "any", rateLimit: { key: "app-newsletter", limit: 3, windowMs: 3600000 } }, async ({ session, request }) => {
  z.object({ consent: z.literal(true) }).parse(await readJson(request));
  return requestNewsletter(session!.user, "app");
});
export const DELETE = api({ auth: "any" }, async ({ session }) => { await revokeNewsletter(session!.user); return { ok: true }; });

import { api } from "@/server/api/handler";
import { newsletterStatus, requestNewsletter, revokeNewsletter } from "@/server/services/newsletter";

/** Newsletter-Einwilligung des eigenen Kontos. Solange NEWSLETTER_ENABLED fehlt, ist nur Abmelden möglich. */
export const GET = api({ auth: "any" }, async ({ session }) => newsletterStatus(session!.user));
export const POST = api({ auth: "any", rateLimit: { key: "app-newsletter", limit: 3, windowMs: 3600000 } }, async ({ session }) => requestNewsletter(session!.user, "app"));
export const DELETE = api({ auth: "any" }, async ({ session }) => { await revokeNewsletter(session!.user); return { ok: true }; });

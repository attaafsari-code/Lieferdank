import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import type { User } from "@/lib/db/types";
import { ServiceError } from "../errors";
import { purposeKey } from "../session";
import { sendMail } from "../mail";
import { emails } from "../emails";
import { baseUrl } from "../site";

/**
 * Newsletter consent with double opt-in, separate from system mails (password reset, receipts).
 * Signup is available independently of any future marketing dispatch job. Only explicitly
 * confirmed consents may receive newsletters. NEWSLETTER_ENABLED=false disables new requests.
 */
const PURPOSE = "newsletter_confirm";

export function newsletterEnabled(): boolean {
  return process.env.NEWSLETTER_ENABLED !== "false";
}

function requireEnabled() {
  if (!newsletterEnabled()) throw new ServiceError("newsletter_unavailable", "Den Newsletter gibt es noch nicht.", 404);
}

export async function newsletterStatus(user: Pick<User, "id">) {
  const consent = await getDb().marketingConsents.findOne({ userId: user.id });
  return { available: newsletterEnabled(), status: consent?.status ?? "none" };
}

/** Records the request (pending) and sends the confirmation link. Never marks anything confirmed by itself. */
export async function requestNewsletter(user: User, source: "web" | "app"): Promise<{ status: "pending" | "confirmed"; mailSent: boolean }> {
  requireEnabled();
  const db = getDb();
  const existing = await db.marketingConsents.findOne({ userId: user.id });
  const now = new Date(Math.max(Date.now(), existing ? new Date(existing.requestedAt).getTime() + 1 : 0)).toISOString();
  if (existing?.status === "confirmed") return { status: "confirmed", mailSent: false };
  if (existing) {
    if (!await db.marketingConsents.updateIf(existing.id, { status: existing.status, requestedAt: existing.requestedAt }, { status: "pending", source, requestedAt: now, confirmedAt: null, revokedAt: null }))
      throw new ServiceError("newsletter_conflict", "Die Anmeldung wurde parallel geändert. Bitte aktualisiere die Seite.", 409);
  } else {
    try { await db.marketingConsents.insert({ id: newId(), userId: user.id, status: "pending", source, requestedAt: now, confirmedAt: null, revokedAt: null }); }
    catch (error) {
      if (await db.marketingConsents.findOne({ userId: user.id })) throw new ServiceError("newsletter_conflict", "Deine Anmeldung wird bereits bearbeitet. Bitte aktualisiere die Seite.", 409);
      throw error;
    }
  }
  const token = await new SignJWT({ sub: user.id, email: user.email, typ: PURPOSE, at: now })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(purposeKey(PURPOSE));
  const cancel = await new SignJWT({ sub: user.id, email: user.email, at: now, typ: "newsletter_revoke" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("365d").sign(purposeKey("newsletter_revoke"));
  const sent = await sendMail(user.email, emails.newsletterConfirm(user.firstName, `${baseUrl()}/newsletter-bestaetigen?token=${token}`, `${baseUrl()}/newsletter-abmelden?token=${cancel}`), "newsletter_confirm");
  return { status: "pending", mailSent: sent.delivered };
}

/** Confirms only the latest request, only for the address it was sent to. */
export async function confirmNewsletter(token: string): Promise<void> {
  requireEnabled();
  const invalid = new ServiceError("newsletter_link_invalid", "Dieser Bestätigungslink ist nicht mehr gültig.", 400);
  if (token.length > 2048) throw invalid;
  let payload;
  try { ({ payload } = await jwtVerify(token, purposeKey(PURPOSE))); } catch { throw invalid; }
  if (payload.typ !== PURPOSE || typeof payload.sub !== "string" || typeof payload.at !== "string") throw invalid;
  const db = getDb();
  const user = await db.users.get(payload.sub);
  const consent = await db.marketingConsents.findOne({ userId: payload.sub });
  if (!user || user.blockedAt || user.email !== payload.email || !consent || consent.requestedAt !== new Date(payload.at).toISOString()) throw invalid;
  if (consent.status === "confirmed") return;
  if (consent.status !== "pending") throw invalid;
  if (!await db.marketingConsents.updateIf(consent.id, { status: "pending", requestedAt: consent.requestedAt }, { status: "confirmed", confirmedAt: new Date().toISOString() })) throw invalid;
}

/** Withdrawal works at any time, also while the newsletter is switched off. */
export async function revokeNewsletter(user: Pick<User, "id">): Promise<void> {
  const table = getDb().marketingConsents;
  for (let attempt = 0; attempt < 3; attempt++) {
    const consent = await table.findOne({ userId: user.id });
    if (!consent || consent.status === "revoked") return;
    if (await table.updateIf(consent.id, { status: consent.status, requestedAt: consent.requestedAt }, { status: "revoked", revokedAt: new Date().toISOString() })) return;
  }
  throw new ServiceError("newsletter_conflict", "Die Anmeldung wurde parallel geändert. Bitte versuche die Abmeldung erneut.", 409);
}

/** E-mail unsubscribe without login, explicit POST so link scanners cannot revoke consent. */
export async function revokeNewsletterLink(token: string): Promise<void> {
  const invalid = new ServiceError("newsletter_link_invalid", "Dieser Abmeldelink ist nicht mehr gültig. Du kannst dich jederzeit in deinem Konto abmelden.", 400);
  if (token.length > 2048) throw invalid;
  let payload;
  try { ({ payload } = await jwtVerify(token, purposeKey("newsletter_revoke"))); } catch { throw invalid; }
  if (payload.typ !== "newsletter_revoke" || typeof payload.sub !== "string" || typeof payload.at !== "string") throw invalid;
  const db = getDb(); const user = await db.users.get(payload.sub);
  const consent = await db.marketingConsents.findOne({ userId: payload.sub });
  if (!user || user.blockedAt || user.email !== payload.email || !consent || consent.requestedAt !== payload.at) throw invalid;
  if (consent.status === "revoked") return;
  if (!await db.marketingConsents.updateIf(consent.id, { requestedAt: payload.at, status: consent.status }, { status: "revoked", revokedAt: new Date().toISOString() })) throw invalid;
}

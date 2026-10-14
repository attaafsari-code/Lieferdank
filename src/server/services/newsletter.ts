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
 * Prepared but switched off: LieferDank has no newsletter yet, so nothing is offered or sent
 * until NEWSLETTER_ENABLED=true. Only confirmed consents may ever receive marketing mail.
 */
const PURPOSE = "newsletter_confirm";

export function newsletterEnabled(): boolean {
  return process.env.NEWSLETTER_ENABLED === "true";
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
  const now = new Date().toISOString();
  const existing = await db.marketingConsents.findOne({ userId: user.id });
  if (existing?.status === "confirmed") return { status: "confirmed", mailSent: false };
  if (existing) await db.marketingConsents.update(existing.id, { status: "pending", source, requestedAt: now, revokedAt: null });
  else await db.marketingConsents.insert({ id: newId(), userId: user.id, status: "pending", source, requestedAt: now, confirmedAt: null, revokedAt: null });
  const token = await new SignJWT({ sub: user.id, email: user.email, typ: PURPOSE, at: now })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(purposeKey(PURPOSE));
  const sent = await sendMail(user.email, emails.newsletterConfirm(user.firstName, `${baseUrl()}/newsletter-bestaetigen?token=${token}`), "newsletter_confirm");
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
  await db.marketingConsents.update(consent.id, { status: "confirmed", confirmedAt: new Date().toISOString() });
}

/** Withdrawal works at any time, also while the newsletter is switched off. */
export async function revokeNewsletter(user: Pick<User, "id">): Promise<void> {
  const consent = await getDb().marketingConsents.findOne({ userId: user.id });
  if (consent && consent.status !== "revoked") await getDb().marketingConsents.update(consent.id, { status: "revoked", revokedAt: new Date().toISOString() });
}

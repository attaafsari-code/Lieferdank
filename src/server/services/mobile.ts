import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { effectiveTip } from "@/lib/money";
import { enforceRateLimitFor } from "../rate-limit";
import { ServiceError } from "../errors";
import { hashPassword, signSessionToken, verifyPassword, type Session } from "../session";
import { authenticate, customerRegistrationSchema, driverRegistrationSchema, loginSchema, parseInput, registerCustomer, registerDriver } from "./auth";
import { exportUserData, deleteAccount } from "./profile";

export function requireMobileEnabled() {
  if (process.env.NODE_ENV === "production" && process.env.DRIVER_APP_ENABLED !== "true")
    throw new ServiceError("app_unavailable", "Die Fahrer-App ist noch nicht freigeschaltet.", 503);
}
/**
 * Native sign-in for every existing web account: drivers, customers and admins share the
 * same user table and password check as lieferdank.de. The role only decides what the app
 * shows; admin rights stay on the web (cookie sessions never accept device tokens).
 */
export async function mobileLogin(input: unknown) {
  requireMobileEnabled();
  const credentials = parseInput(loginSchema.extend({ password: z.string().min(1).max(200) }), input);
  enforceRateLimitFor(`mobile-login-email:${credentials.email}`, 20, 15 * 60000);
  const user = await authenticate(credentials);
  if (user.role === "driver" && !await getDb().driverProfiles.findOne({ userId: user.id }))
    throw new ServiceError("profile_missing", "Dein Profil konnte nicht geladen werden. Bitte wende dich an den Support.", 409);
  if (user.role === "customer" && !await getDb().customerProfiles.findOne({ userId: user.id }))
    await getDb().customerProfiles.insert({ id: newId(), userId: user.id, createdAt: new Date().toISOString() });
  return createMobileSession(user);
}

async function createMobileSession(user: import("@/lib/db/types").User) {
  const id = newId();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await getDb().mobileSessions.insert({ id, userId: user.id, tokenVersion: user.tokenVersion ?? 0, expiresAt, revokedAt: null, pushToken: null, pushEnabled: false, createdAt: new Date().toISOString() });
  return { token: await signSessionToken(user, id), expiresAt, role: user.role };
}
/** Same account/profile/mail pipeline as the web; role and ownership are server-controlled. */
export async function mobileRegister(input: unknown) {
  requireMobileEnabled();
  const raw = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const terms = raw.acceptedTerms === true ? "on" : undefined;
  // Only the two self-service roles exist; anything else (e.g. "admin") falls back to driver.
  if (raw.role === "customer") {
    const body = parseInput(customerRegistrationSchema.extend({ acceptedTerms: z.literal(true) }), { ...raw, saveCode: undefined, terms });
    enforceRateLimitFor(`mobile-register-email:${body.email}`, 3, 3600000);
    const user = await registerCustomer(body);
    return { ...await createMobileSession(user), mailSent: user.welcomeMailSent };
  }
  const body = parseInput(driverRegistrationSchema.extend({ acceptedTerms: z.literal(true) }), { ...raw, terms });
  enforceRateLimitFor(`mobile-register-email:${body.email}`, 3, 3600000);
  const user = await registerDriver(body);
  return { ...await createMobileSession(user), mailSent: user.welcomeMailSent };
}
export function deviceId(session: Session): string {
  if (!session.mobileSessionId) throw new ServiceError("device_session_required", "Bitte melde dich in der App erneut an.", 401);
  return session.mobileSessionId;
}
export async function mobileLogout(session: Session) {
  await getDb().mobileSessions.update(deviceId(session), { revokedAt: new Date().toISOString(), pushToken: null, pushEnabled: false });
}
export async function revokeMobileSessions(userId: string) {
  for (const device of await getDb().mobileSessions.findMany({ where: { userId } }))
    await getDb().mobileSessions.update(device.id, { revokedAt: new Date().toISOString(), pushToken: null, pushEnabled: false });
}
export async function changeMobilePassword(session: Session, input: unknown) {
  const { currentPassword, newPassword } = parseInput(z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) }), input);
  const user = session.user;
  if (!await verifyPassword(currentPassword, user.passwordHash)) throw new ServiceError("invalid_password", "Das aktuelle Passwort ist falsch.", 400);
  const passwordHash = await hashPassword(newPassword);
  if (!await getDb().users.updateIf(user.id, { tokenVersion: user.tokenVersion }, { passwordHash, tokenVersion: (user.tokenVersion ?? 0) + 1 }))
    throw new ServiceError("conflict", "Dein Konto wurde parallel geändert. Bitte erneut anmelden.", 409);
  await revokeMobileSessions(user.id);
}
export async function removeMobileAccount(session: Session, input: unknown) {
  const { password } = parseInput(z.object({ password: z.string().min(1).max(200) }), input);
  if (session.user.role === "admin")
    throw new ServiceError("admin_account", "Administratorkonten können nicht in der App gelöscht werden.", 403);
  if (!await verifyPassword(password, session.user.passwordHash)) throw new ServiceError("invalid_password", "Das Passwort ist falsch.", 400);
  await deleteAccount(session.user);
  await revokeMobileSessions(session.user.id);
}
export async function mobileExport(user: import("@/lib/db/types").User) {
  const data = await exportUserData(user);
  const devices = await getDb().mobileSessions.findMany({ where: { userId: user.id } });
  return { ...data, appDevices: devices.map(({ createdAt, expiresAt, revokedAt, pushEnabled }) => ({ createdAt, expiresAt, revokedAt, pushEnabled })) };
}
export function pageQuery(input: URLSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(input.get("limit") ?? 30) || 30));
  let before: { createdAt: string; id: string } | undefined;
  if (input.has("before")) {
    try {
      before = z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).parse(JSON.parse(Buffer.from(input.get("before")!, "base64url").toString("utf8")));
      before.createdAt = new Date(before.createdAt).toISOString();
    } catch { throw new ServiceError("invalid_cursor", "Ungültiger Zeitraum.", 400); }
  }
  return { limit, before };
}
export function nextPage(items: { id: string; createdAt: string }[], limit: number) {
  const last = items.at(-1); return items.length === limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url") : null;
}
export async function earnings(driverId: string, input: URLSearchParams) {
  const { limit, before } = pageQuery(input);
  const page = await getDb().tips.findMany({ where: { driverId }, orderBy: "createdAt", desc: true, limit, before });
  return { items: page.map(t => ({ id: t.id, grossCents: t.grossCents, shareBeforeStripeCents: effectiveTip(t).driverCents,
    refundedCents: t.refundedCents, paymentStatus: t.paymentStatus, createdAt: t.createdAt })), nextCursor: nextPage(page, limit) };
}

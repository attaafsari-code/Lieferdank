import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify, decodeJwt, type JWTPayload } from "jose";
import { getDb } from "@/lib/db";
import type { CustomerProfile, DriverProfile, User } from "@/lib/db/types";

/**
 * Sessions für Web (HttpOnly-Cookie) und App (Bearer-Token).
 * Beide nutzen dasselbe signierte JWT, gebunden an die Token-Version des Nutzers:
 * Nach einem Passwortwechsel sind alle älteren Sessions sofort ungültig.
 */

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "ld_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).");
    }
    return new TextEncoder().encode("lieferdank-dev-secret-nur-lokal-nicht-produktiv");
  }
  return new TextEncoder().encode(value);
}

/* ---------- Passwörter ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}

/* ---------- Tokens ---------- */

export async function signSessionToken(user: Pick<User, "id" | "tokenVersion">, sessionId?: string): Promise<string> {
  return new SignJWT({ sub: user.id, v: user.tokenVersion ?? 0, ...(sessionId ? { sid: sessionId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

async function userFromToken(token: string): Promise<User | null> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, secret()));
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || payload.typ !== undefined) return null;
  // Infrastructure failures propagate as server errors, not expired sessions.
  const user = await getDb().users.get(payload.sub);
  if (!user || user.blockedAt) return null;
  const version = typeof payload.v === "number" ? payload.v : 0;
  if (version !== (user.tokenVersion ?? 0)) return null;
  if (payload.sid !== undefined) {
    if (typeof payload.sid !== "string") return null;
    const device = await getDb().mobileSessions.get(payload.sid);
    if (!device || device.userId !== user.id || device.revokedAt || new Date(device.expiresAt).getTime() <= Date.now()) return null;
  }
  return user;
}

/* ---------- E-Mail-Bestätigung ---------- */

export const EMAIL_VERIFICATION_TTL_DAYS = 7;
const EMAIL_VERIFICATION = "email_verification";

/**
 * Eigener, aus AUTH_SECRET abgeleiteter Schlüssel je Zweck: Ein Token für einen Zweck (z. B. ein
 * Bestätigungslink) gilt nie für einen anderen und nie als Sitzung – und umgekehrt.
 */
export function purposeKey(purpose: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secret()).update(`:${purpose}`).digest());
}

function emailVerificationKey(): Uint8Array {
  return purposeKey(EMAIL_VERIFICATION);
}

export async function signEmailVerificationToken(user: Pick<User, "id" | "email">): Promise<string> {
  return new SignJWT({ sub: user.id, email: user.email, typ: EMAIL_VERIFICATION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EMAIL_VERIFICATION_TTL_DAYS}d`)
    .sign(emailVerificationKey());
}

/** Liefert, für welches Konto und welche Adresse der Link ausgestellt wurde – oder null. */
export async function readEmailVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, emailVerificationKey());
    if (payload.typ !== EMAIL_VERIFICATION || typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/* ---------- Web-Session (Cookie) ---------- */

export async function createSession(user: Pick<User, "id" | "tokenVersion">): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export type Session = {
  user: User;
  driver: DriverProfile | null;
  customer: CustomerProfile | null;
  mobileSessionId?: string;
};

async function sessionFor(user: User | null): Promise<Session | null> {
  if (!user) return null;
  const db = getDb();
  const [driver, customer] = await Promise.all([
    user.role === "driver" ? db.driverProfiles.findOne({ userId: user.id }) : Promise.resolve(null),
    user.role === "customer" ? db.customerProfiles.findOne({ userId: user.id }) : Promise.resolve(null),
  ]);
  return { user, driver, customer };
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionFor(token ? await userFromToken(token) : null);
}

export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  return session?.user.role === "admin" ? session : null;
}

/* ---------- App-Session (Bearer) ---------- */

/**
 * Für die API: nur Bearer-Tokens. Cookies werden hier bewusst ignoriert,
 * damit schreibende API-Endpunkte nicht per CSRF missbraucht werden können.
 */
export async function getBearerSession(request: Request): Promise<Session | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1].trim();
  const session = await sessionFor(token ? await userFromToken(token) : null);
  if (session && token) {
    const payload = decodeJwt(token);
    if (typeof payload.sid === "string") session.mobileSessionId = payload.sid;
  }
  return session;
}

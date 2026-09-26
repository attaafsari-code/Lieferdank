import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getStore } from "./db";
import type { DriverProfile, User } from "./db/types";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "ld_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).");
    }
    // Nur lokal: stabiler Entwicklungsschluessel, damit Sessions Neustarts ueberleben.
    return new TextEncoder().encode("lieferdank-dev-secret-nur-lokal-nicht-produktiv");
  }
  return new TextEncoder().encode(value);
}

/* ---------- Passwoerter ---------- */

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
  if (expected.length !== key.length) return false;
  return timingSafeEqual(key, expected);
}

/* ---------- Session ---------- */

export async function createSession(userId: string, tokenVersion = 0): Promise<void> {
  const token = await new SignJWT({ sub: userId, v: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.sub;
    if (typeof userId !== "string") return null;

    const user = await getStore().getUserById(userId);
    if (!user || user.blockedAt) return null;

    // Nach einem Passwortwechsel sind aeltere Sessions ungueltig.
    const version = typeof payload.v === "number" ? payload.v : 0;
    if (version !== (user.tokenVersion ?? 0)) return null;

    return user;
  } catch {
    return null;
  }
}

export type Session = { user: User; driver: DriverProfile | null };

export async function getSession(): Promise<Session | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const driver = await getStore().getDriverByUserId(user.id);
  return { user, driver };
}

/** Fuer Adminbereich: wirft nicht, gibt null zurueck -- der Aufrufer redirected. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return null;
  return session;
}
